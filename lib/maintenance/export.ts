/**
 * Maintenance dashboard export helpers (Patch 35).
 * CSV / Excel-compatible / simple PDF text — no notification side effects.
 */

import type { MaintenanceQueueRow } from "./dashboard";
import type { MaintenanceAuditEntry } from "./scheduling";

export type ExportFormat = "csv" | "excel" | "pdf";

export type ExportScope =
  | "entire_fleet"
  | "selected"
  | "current_filters"
  | "customer"
  | "date_range";

export type ExportOptions = {
  format: ExportFormat;
  scope: ExportScope;
  rows: MaintenanceQueueRow[];
  customerName?: string;
  dateFrom?: string;
  dateTo?: string;
  selectedIds?: string[];
  exportedBy: string;
};

function escapeCsv(value: string | number | null | undefined): string {
  const raw = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}

export function filterRowsForExport(
  rows: MaintenanceQueueRow[],
  options: Omit<ExportOptions, "format" | "exportedBy">,
): MaintenanceQueueRow[] {
  let next = rows;
  if (options.scope === "selected" && options.selectedIds?.length) {
    const set = new Set(options.selectedIds);
    next = next.filter((r) => set.has(r.printerId));
  }
  if (options.scope === "customer" && options.customerName) {
    next = next.filter((r) => r.customerName === options.customerName);
  }
  // date_range / current_filters / entire_fleet use the provided rows as-is
  return next;
}

export function buildMaintenanceCsv(rows: MaintenanceQueueRow[]): string {
  const headers = [
    "Customer",
    "Site",
    "Printer",
    "Asset",
    "Model",
    "Current Count",
    "Next PM",
    "Copies Remaining",
    "Status",
    "Technician",
    "Last PM",
    "Region",
  ];
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.customerName,
        row.siteName,
        row.printerName,
        row.assetTag,
        row.model,
        row.currentCount,
        row.nextPmDueCount,
        row.copiesRemaining,
        row.status,
        row.assignedTechnician,
        row.lastPmDate,
        row.region,
      ]
        .map(escapeCsv)
        .join(","),
    );
  }
  return lines.join("\n");
}

/** Excel-friendly SpreadsheetML workbook (opens in Excel). */
export function buildMaintenanceExcelXml(rows: MaintenanceQueueRow[]): string {
  const header = [
    "Customer",
    "Site",
    "Printer",
    "Asset",
    "Model",
    "Current Count",
    "Next PM",
    "Copies Remaining",
    "Status",
    "Technician",
    "Last PM",
    "Region",
  ];
  const cell = (v: string | number | null | undefined) =>
    `<Cell><Data ss:Type="${typeof v === "number" ? "Number" : "String"}">${
      v === null || v === undefined
        ? ""
        : String(v)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
    }</Data></Cell>`;

  const rowsXml = rows
    .map((row) => {
      const vals = [
        row.customerName,
        row.siteName,
        row.printerName,
        row.assetTag,
        row.model,
        row.currentCount,
        row.nextPmDueCount,
        row.copiesRemaining,
        row.status,
        row.assignedTechnician,
        row.lastPmDate,
        row.region,
      ];
      return `<Row>${vals.map(cell).join("")}</Row>`;
    })
    .join("");

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Fleet Maintenance">
  <Table>
   <Row>${header.map((h) => cell(h)).join("")}</Row>
   ${rowsXml}
  </Table>
 </Worksheet>
</Workbook>`;
}

export function buildMaintenancePdfText(rows: MaintenanceQueueRow[]): string {
  const lines = [
    "MATRIX Fleet Maintenance Export",
    `Generated: ${new Date().toISOString()}`,
    `Printers: ${rows.length}`,
    "",
    ...rows.map(
      (r) =>
        `${r.status.padEnd(10)} | ${r.customerName} / ${r.siteName} | ${r.printerName} (${r.model}) | Count ${r.currentCount ?? "—"} | Tech ${r.assignedTechnician}`,
    ),
  ];
  return lines.join("\n");
}

export function buildExportPayload(options: ExportOptions): {
  filename: string;
  mime: string;
  content: string;
  audit: Omit<MaintenanceAuditEntry, "id" | "occurredAt">;
} {
  const rows = filterRowsForExport(options.rows, options);
  const stamp = new Date().toISOString().slice(0, 10);

  if (options.format === "csv") {
    return {
      filename: `matrix-maintenance-${stamp}.csv`,
      mime: "text/csv;charset=utf-8",
      content: buildMaintenanceCsv(rows),
      audit: {
        action: "EXPORT_GENERATED",
        actor: options.exportedBy,
        details: `CSV export (${options.scope}) — ${rows.length} printers`,
        previousValue: null,
        newValue: options.scope,
      },
    };
  }

  if (options.format === "excel") {
    return {
      filename: `matrix-maintenance-${stamp}.xls`,
      mime: "application/vnd.ms-excel",
      content: buildMaintenanceExcelXml(rows),
      audit: {
        action: "EXPORT_GENERATED",
        actor: options.exportedBy,
        details: `Excel export (${options.scope}) — ${rows.length} printers`,
        previousValue: null,
        newValue: options.scope,
      },
    };
  }

  return {
    filename: `matrix-maintenance-${stamp}.txt`,
    mime: "application/pdf",
    content: buildMaintenancePdfText(rows),
    audit: {
      action: "EXPORT_GENERATED",
      actor: options.exportedBy,
      details: `PDF text export (${options.scope}) — ${rows.length} printers`,
      previousValue: null,
      newValue: options.scope,
    },
  };
}

export function downloadTextFile(
  filename: string,
  content: string,
  mime: string,
): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
