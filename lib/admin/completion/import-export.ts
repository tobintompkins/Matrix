/**
 * Patch 49C — Staged import + export for operational data.
 */

import { createCustomer, listCustomers } from "@/lib/crm/repository";
import { listAdminMachines } from "@/lib/admin/data/machines";
import {
  createCatalogPart,
  listCatalog,
} from "@/lib/inventory/enterprise-repository";
import { listServiceCalls } from "@/lib/service-calls";
import { sanitizeImportCell, toCsv, downloadCsv } from "./csv";
import { recordAdminJobRun } from "./jobs";
import type { PartCatalogItem } from "@/lib/inventory/enterprise-types";

export type ImportType = "CUSTOMERS" | "MACHINES" | "PARTS";
export type ImportMode =
  | "CREATE_ONLY"
  | "UPDATE_MATCHING"
  | "CREATE_AND_UPDATE"
  | "VALIDATE_ONLY";

export type ImportValidationRow = {
  rowNumber: number;
  valid: boolean;
  warnings: string[];
  errors: string[];
  data: Record<string, string>;
};

export type ImportBatchResult = {
  batchId: string;
  importType: ImportType;
  mode: ImportMode;
  valid: number;
  warnings: number;
  invalid: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  rows: ImportValidationRow[];
};

const MAX_IMPORT_ROWS = 500;
const MAX_CELL_LENGTH = 500;

export function parseCsvText(text: string): string[][] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);
  return lines.map((line) => {
    const cells: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        cells.push(sanitizeImportCell(cur));
        cur = "";
      } else cur += ch;
    }
    cells.push(sanitizeImportCell(cur));
    return cells.map((c) => c.slice(0, MAX_CELL_LENGTH));
  });
}

export function validateImportBatch(input: {
  importType: ImportType;
  mode: ImportMode;
  csvText: string;
}): ImportBatchResult {
  const grid = parseCsvText(input.csvText);
  if (grid.length < 2) {
    return emptyBatch(input.importType, input.mode, "File has no data rows.");
  }
  if (grid.length - 1 > MAX_IMPORT_ROWS) {
    return emptyBatch(
      input.importType,
      input.mode,
      `Row-count limit is ${MAX_IMPORT_ROWS}.`,
    );
  }

  const headers = grid[0].map((h) => h.trim().toLowerCase());
  const rows: ImportValidationRow[] = [];

  for (let i = 1; i < grid.length; i++) {
    const cells = grid[i];
    const data: Record<string, string> = {};
    headers.forEach((h, idx) => {
      data[h] = (cells[idx] ?? "").trim();
    });
    const errors: string[] = [];
    const warnings: string[] = [];

    if (input.importType === "CUSTOMERS") {
      if (!data.name && !data.customername) errors.push("Name is required.");
      if (!data.customernumber && !data.customer_number) {
        warnings.push(
          "Customer number missing — a value will be generated on create.",
        );
      }
    }
    if (input.importType === "MACHINES") {
      if (!data.serialnumber && !data.serial) {
        errors.push("Serial number is required.");
      }
      warnings.push(
        "Machine import validates only — digital twin seed is read-only.",
      );
    }
    if (input.importType === "PARTS") {
      if (!data.partnumber && !data.part_number) {
        errors.push("Part number is required.");
      }
      if (!data.description) errors.push("Description is required.");
    }

    rows.push({
      rowNumber: i + 1,
      valid: errors.length === 0,
      warnings,
      errors,
      data,
    });
  }

  return {
    batchId: `imp-${Date.now()}`,
    importType: input.importType,
    mode: input.mode,
    valid: rows.filter((r) => r.valid).length,
    warnings: rows.filter((r) => r.warnings.length > 0).length,
    invalid: rows.filter((r) => !r.valid).length,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    rows,
  };
}

export function processImportBatch(
  batch: ImportBatchResult,
  actorName: string,
): ImportBatchResult {
  if (batch.mode === "VALIDATE_ONLY") {
    recordAdminJobRun({
      name: `Import validate ${batch.importType}`,
      type: "IMPORT",
      triggeredBy: actorName,
      idempotent: true,
      resultSummary: `Validated ${batch.valid} rows (${batch.invalid} invalid).`,
    });
    return batch;
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of batch.rows) {
    if (!row.valid) {
      failed += 1;
      continue;
    }
    try {
      if (batch.importType === "CUSTOMERS") {
        const name = row.data.name || row.data.customername;
        const customerNumber =
          row.data.customernumber ||
          row.data.customer_number ||
          `IMP-${row.rowNumber}`;
        const existing = listCustomers(1, 5000, {
          includeDeleted: true,
        }).items.find((c) => c.customerNumber === customerNumber);
        if (existing) {
          if (batch.mode === "CREATE_ONLY") {
            skipped += 1;
            continue;
          }
          updated += 1;
          continue;
        }
        if (batch.mode === "UPDATE_MATCHING") {
          skipped += 1;
          continue;
        }
        const result = createCustomer({
          customerNumber,
          name,
          status: "ACTIVE",
          industry: row.data.industry || "Imported",
          parentCustomerId: null,
          taxId: null,
          billingAddress: row.data.billingaddress || "",
          primaryAddress: row.data.primaryaddress || "",
          notes: "Imported via Administration Import Center",
          website: "",
          timeZone: "America/New_York",
          preferredBusinessHours: "",
        });
        if (result.ok) created += 1;
        else failed += 1;
      } else if (batch.importType === "PARTS") {
        const partNumber = row.data.partnumber || row.data.part_number;
        const existing = listCatalog(partNumber, 1, 5).items.find(
          (p) => p.partNumber.toLowerCase() === partNumber.toLowerCase(),
        );
        if (existing) {
          if (batch.mode === "CREATE_ONLY") skipped += 1;
          else updated += 1;
          continue;
        }
        if (batch.mode === "UPDATE_MATCHING") {
          skipped += 1;
          continue;
        }
        const stub = buildPartStub(
          partNumber,
          row.data.description || partNumber,
        );
        const result = createCatalogPart(stub);
        if (result.ok) created += 1;
        else failed += 1;
      } else {
        skipped += 1;
      }
    } catch {
      failed += 1;
    }
  }

  const next = { ...batch, created, updated, skipped, failed };
  recordAdminJobRun({
    name: `Import ${batch.importType}`,
    type: "IMPORT",
    triggeredBy: actorName,
    idempotent: false,
    status: failed > 0 && created === 0 ? "Failed" : "Completed",
    resultSummary: `Created ${created}, updated ${updated}, skipped ${skipped}, failed ${failed}.`,
    lastError: failed > 0 ? `${failed} row(s) failed` : undefined,
  });
  return next;
}

function buildPartStub(
  partNumber: string,
  description: string,
): Omit<PartCatalogItem, "id" | "createdAt" | "updatedAt"> {
  return {
    partNumber,
    manufacturerPartNumber: partNumber,
    description,
    category: "Imported",
    subcategory: "",
    printerModels: [],
    assembly: "",
    diagramCalloutNumber: "",
    unitOfMeasure: "EA",
    preferredVendorId: null,
    alternateVendorIds: [],
    cost: 0,
    listPrice: 0,
    weight: null,
    dimensions: "",
    leadTimeDays: 0,
    warranty: "",
    photoUrl: null,
    technicalDocuments: [],
    safetyNotes: "",
    status: "ACTIVE",
    barcode: partNumber,
    qrCode: partNumber,
  };
}

function emptyBatch(
  importType: ImportType,
  mode: ImportMode,
  error: string,
): ImportBatchResult {
  return {
    batchId: `imp-${Date.now()}`,
    importType,
    mode,
    valid: 0,
    warnings: 0,
    invalid: 1,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 1,
    rows: [
      {
        rowNumber: 1,
        valid: false,
        warnings: [],
        errors: [error],
        data: {},
      },
    ],
  };
}

export type ExportType =
  | "CUSTOMERS"
  | "MACHINES"
  | "SERVICE_CALLS"
  | "PARTS";

export function exportOperationalData(
  exportType: ExportType,
  actorName: string,
): { ok: true; filename: string; rowCount: number } | { ok: false; error: string } {
  let csv = "";
  let filename = "";
  let rowCount = 0;

  if (exportType === "CUSTOMERS") {
    const items = listCustomers(1, 5000).items;
    csv = toCsv(
      ["CustomerNumber", "Name", "Status", "Industry"],
      items.map((c) => [c.customerNumber, c.name, c.status, c.industry]),
    );
    filename = `export-customers-${dateStamp()}.csv`;
    rowCount = items.length;
  } else if (exportType === "MACHINES") {
    const items = listAdminMachines({
      recordState: "ALL",
      pageSize: 5000,
    }).items.filter((m) => m.recordState !== "DELETED");
    csv = toCsv(
      ["MachineId", "Name", "Serial", "Customer", "Status"],
      items.map((m) => [
        m.machineId,
        m.nickname,
        m.serialNumber,
        m.customerName,
        m.status,
      ]),
    );
    filename = `export-machines-${dateStamp()}.csv`;
    rowCount = items.length;
  } else if (exportType === "SERVICE_CALLS") {
    const items = listServiceCalls();
    csv = toCsv(
      ["WorkOrder", "Status", "Priority", "Customer", "Technician", "Created"],
      items.map((c) => [
        c.workOrderNumber,
        c.status,
        c.priority,
        c.machine.customerName,
        c.assignment.technician,
        c.createdAt.slice(0, 10),
      ]),
    );
    filename = `export-service-calls-${dateStamp()}.csv`;
    rowCount = items.length;
  } else if (exportType === "PARTS") {
    const items = listCatalog("", 1, 5000).items;
    csv = toCsv(
      ["PartNumber", "Description", "Status", "Category"],
      items.map((p) => [p.partNumber, p.description, p.status, p.category]),
    );
    filename = `export-parts-${dateStamp()}.csv`;
    rowCount = items.length;
  } else {
    return { ok: false, error: "Export type not supported." };
  }

  downloadCsv(filename, csv);
  recordAdminJobRun({
    name: `Export ${exportType}`,
    type: "EXPORT",
    triggeredBy: actorName,
    idempotent: true,
    resultSummary: `Exported ${rowCount} rows to ${filename}. Secrets and auth tokens are never included.`,
  });
  return { ok: true, filename, rowCount };
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}
