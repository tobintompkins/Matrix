import type { MeterCountSource, MeterImportBatch, MeterReading, PmChecklistItem } from "./types";

export type CountValidationResult =
  | { ok: true; warnings: string[]; suspectedReset: boolean; unusualIncrease: boolean }
  | {
      ok: false;
      error: string;
      requiresOverride?: boolean;
      warnings: string[];
      suspectedReset: boolean;
      unusualIncrease: boolean;
    };

export function validateMeterCount(input: {
  newCount: number;
  previousCount: number | null;
  avgDailyVolume: number | null;
  unusualIncreaseMultiplier: number;
  overrideReason?: string;
  recordedAt: string;
  existingReadings: MeterReading[];
}): CountValidationResult {
  const warnings: string[] = [];
  let suspectedReset = false;
  let unusualIncrease = false;

  if (!Number.isFinite(input.newCount) || !Number.isInteger(input.newCount)) {
    return {
      ok: false,
      error: "Meter count must be a whole number.",
      warnings,
      suspectedReset,
      unusualIncrease,
    };
  }
  if (input.newCount < 0) {
    return {
      ok: false,
      error: "Meter count cannot be negative.",
      warnings,
      suspectedReset,
      unusualIncrease,
    };
  }

  const dup = input.existingReadings.find(
    (r) =>
      r.meterCount === input.newCount &&
      r.recordedAt.slice(0, 10) === input.recordedAt.slice(0, 10),
  );
  if (dup) {
    return {
      ok: false,
      error: "Duplicate count submission detected for this date.",
      warnings,
      suspectedReset,
      unusualIncrease,
    };
  }

  if (input.previousCount != null && input.newCount < input.previousCount) {
    suspectedReset = true;
    warnings.push(
      `New count (${input.newCount}) is lower than previous (${input.previousCount}). Possible meter reset.`,
    );
    if (!input.overrideReason?.trim()) {
      return {
        ok: false,
        error: "Lower count requires an override reason.",
        requiresOverride: true,
        warnings,
        suspectedReset,
        unusualIncrease,
      };
    }
  }

  if (
    input.previousCount != null &&
    input.newCount > input.previousCount &&
    input.avgDailyVolume != null &&
    input.avgDailyVolume > 0
  ) {
    const increase = input.newCount - input.previousCount;
    const threshold =
      input.avgDailyVolume * 30 * input.unusualIncreaseMultiplier;
    if (increase > threshold) {
      unusualIncrease = true;
      warnings.push(
        `Unusually large increase of ${increase.toLocaleString()} impressions.`,
      );
      if (!input.overrideReason?.trim()) {
        return {
          ok: false,
          error: "Unusual increase requires an override reason.",
          requiresOverride: true,
          warnings,
          suspectedReset,
          unusualIncrease,
        };
      }
    }
  }

  return { ok: true, warnings, suspectedReset, unusualIncrease };
}

export function parseMeterCsv(csv: string): {
  rows: Array<{
    row: number;
    printerId: string;
    meterCount: number;
    recordedAt: string;
    enteredBy: string;
    notes: string;
  }>;
  errors: Array<{ row: number; message: string }>;
} {
  const lines = csv
    .trim()
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { rows: [], errors: [{ row: 1, message: "CSV requires a header and at least one data row." }] };
  }
  const header = lines[0].toLowerCase();
  if (!header.includes("printer") || !header.includes("count")) {
    return {
      rows: [],
      errors: [{ row: 1, message: "Header must include printerId and meterCount columns." }],
    };
  }
  const cols = lines[0].split(",").map((c) => c.trim().toLowerCase());
  const idx = {
    printerId: cols.findIndex((c) => c === "printerid" || c === "printer_id" || c === "machine"),
    meterCount: cols.findIndex((c) => c === "metercount" || c === "meter_count" || c === "count"),
    recordedAt: cols.findIndex((c) => c === "date" || c === "recordedat" || c === "recorded_at"),
    enteredBy: cols.findIndex((c) => c === "enteredby" || c === "entered_by" || c === "technician"),
    notes: cols.findIndex((c) => c === "notes"),
  };
  if (idx.printerId < 0 || idx.meterCount < 0) {
    return {
      rows: [],
      errors: [{ row: 1, message: "Missing required columns printerId and meterCount." }],
    };
  }

  const rows: Array<{
    row: number;
    printerId: string;
    meterCount: number;
    recordedAt: string;
    enteredBy: string;
    notes: string;
  }> = [];
  const errors: Array<{ row: number; message: string }> = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",").map((p) => p.trim());
    const printerId = parts[idx.printerId] ?? "";
    const countRaw = parts[idx.meterCount] ?? "";
    const count = Number(countRaw);
    if (!printerId) {
      errors.push({ row: i + 1, message: "Missing printerId" });
      continue;
    }
    if (!Number.isInteger(count) || count < 0) {
      errors.push({ row: i + 1, message: `Invalid meter count: ${countRaw}` });
      continue;
    }
    rows.push({
      row: i + 1,
      printerId,
      meterCount: count,
      recordedAt:
        idx.recordedAt >= 0 && parts[idx.recordedAt]
          ? parts[idx.recordedAt]
          : new Date().toISOString().slice(0, 10),
      enteredBy:
        idx.enteredBy >= 0 && parts[idx.enteredBy]
          ? parts[idx.enteredBy]
          : "CSV Import",
      notes: idx.notes >= 0 ? parts[idx.notes] ?? "" : "",
    });
  }
  return { rows, errors };
}

export function meterImportTemplateCsv(): string {
  return [
    "printerId,meterCount,date,enteredBy,notes",
    "MX-GD-001,1250000,2026-07-13,Alex Rivera,Monthly reading",
  ].join("\n");
}

export function createImportBatch(input: {
  fileName: string;
  importedBy: string;
  totalRows: number;
  successCount: number;
  errors: Array<{ row: number; message: string }>;
}): MeterImportBatch {
  return {
    id: `imp-${Date.now()}`,
    fileName: input.fileName,
    importedAt: new Date().toISOString(),
    importedBy: input.importedBy,
    totalRows: input.totalRows,
    successCount: input.successCount,
    errorCount: input.errors.length,
    errors: input.errors,
  };
}

export function defaultPmChecklist(printerModel: string): PmChecklistItem[] {
  return [
    {
      id: "chk-1",
      taskName: "Verify machine identity",
      description: `Confirm serial/asset for ${printerModel}`,
      required: true,
      recommended: true,
      photoRequired: false,
      completionStatus: "PENDING",
      technicianNotes: "",
      measurement: "",
      passFail: null,
      followUpRequired: false,
    },
    {
      id: "chk-2",
      taskName: "Record starting meter",
      description: "Enter meter before service",
      required: true,
      recommended: true,
      photoRequired: true,
      completionStatus: "PENDING",
      technicianNotes: "",
      measurement: "",
      passFail: null,
      followUpRequired: false,
    },
    {
      id: "chk-3",
      taskName: "Replace PM kit consumables",
      description: "Install required PM kit parts",
      required: true,
      recommended: true,
      photoRequired: false,
      completionStatus: "PENDING",
      technicianNotes: "",
      measurement: "",
      passFail: null,
      followUpRequired: false,
    },
    {
      id: "chk-4",
      taskName: "Clean paper path",
      description: "General preventive cleaning",
      required: false,
      recommended: true,
      photoRequired: false,
      completionStatus: "PENDING",
      technicianNotes: "",
      measurement: "",
      passFail: null,
      followUpRequired: false,
    },
    {
      id: "chk-5",
      taskName: "Test print / quality check",
      description: "Confirm print quality after PM",
      required: true,
      recommended: true,
      photoRequired: true,
      completionStatus: "PENDING",
      technicianNotes: "",
      measurement: "",
      passFail: null,
      followUpRequired: false,
    },
  ];
}

export function buildMeterReading(input: {
  printerId: string;
  meterCount: number;
  previousCount: number | null;
  recordedAt: string;
  countTime: string;
  operatingHours?: number | null;
  colorCount?: number | null;
  blackCount?: number | null;
  duplexCount?: number | null;
  scanCount?: number | null;
  notes: string;
  source: MeterCountSource;
  enteredBy: string;
  photoUrl?: string | null;
  validationOverrideReason?: string | null;
  suspectedReset: boolean;
  unusualIncrease: boolean;
}): MeterReading {
  return {
    id: `mr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    printerId: input.printerId,
    meterCount: input.meterCount,
    previousCount: input.previousCount,
    countIncrease:
      input.previousCount != null ? input.meterCount - input.previousCount : null,
    recordedAt: input.recordedAt,
    countTime: input.countTime,
    operatingHours: input.operatingHours ?? null,
    colorCount: input.colorCount ?? null,
    blackCount: input.blackCount ?? null,
    duplexCount: input.duplexCount ?? null,
    scanCount: input.scanCount ?? null,
    notes: input.notes,
    source: input.source,
    enteredBy: input.enteredBy,
    photoUrl: input.photoUrl ?? null,
    validationOverrideReason: input.validationOverrideReason ?? null,
    suspectedReset: input.suspectedReset,
    unusualIncrease: input.unusualIncrease,
  };
}
