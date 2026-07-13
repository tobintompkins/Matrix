/**
 * PM Intelligence repository (Patch 44) — sessionStorage + maintenance/inventory integration.
 */

import {
  completeMaintenance,
  listCopyCountHistory,
  listMaintenanceCompletions,
  listAllMaintenanceCompletions,
  listMaintenanceProfiles,
  listMaintenanceSchedules,
  recordCopyCount,
  scheduleMaintenance,
  type PrinterMaintenanceProfile,
} from "@/lib/maintenance";
import { listBalances, postTransaction } from "@/lib/inventory";
import {
  buildCleaningRowsFromProfiles,
  buildDashboardMetrics,
  buildForecast,
  buildMeterTableRow,
  computeMachineHealthScore,
  filterMeterRows,
} from "./calculations";
import {
  buildMeterReading,
  createImportBatch,
  defaultPmChecklist,
  meterImportTemplateCsv,
  parseMeterCsv,
  validateMeterCount,
} from "./operations";
import {
  CLEANING_INTERVAL_RULES,
  defaultPmSettings,
  PM_INTERVAL_RULES,
  PM_PARTS_KITS,
} from "./seed";
import type {
  CleaningCompletion,
  CleaningScheduleRow,
  CleaningTypeId,
  ForecastWindow,
  MeterImportBatch,
  MeterReading,
  MeterTableRow,
  PmAuditEntry,
  PmCompletionSession,
  PmHistoryRow,
  PmIntelligenceFilters,
  PmPartsKit,
  PmScheduleRow,
  PmSettings,
} from "./types";

const STORAGE_KEY = "matrix.pm-intelligence.v1";

type Store = {
  readings: MeterReading[];
  imports: MeterImportBatch[];
  cleanings: CleaningCompletion[];
  completionSessions: PmCompletionSession[];
  audit: PmAuditEntry[];
  settings: PmSettings;
  intervalRules: typeof PM_INTERVAL_RULES;
  cleaningRules: typeof CLEANING_INTERVAL_RULES;
  partsKits: PmPartsKit[];
};

let memoryStore: Store | null = null;

function seedStore(): Store {
  return {
    readings: [],
    imports: [],
    cleanings: [],
    completionSessions: [],
    audit: [],
    settings: defaultPmSettings(),
    intervalRules: structuredClone(PM_INTERVAL_RULES),
    cleaningRules: structuredClone(CLEANING_INTERVAL_RULES),
    partsKits: structuredClone(PM_PARTS_KITS),
  };
}

function readStore(): Store {
  if (typeof window === "undefined") {
    if (!memoryStore) memoryStore = seedStore();
    return memoryStore;
  }
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      memoryStore = JSON.parse(raw) as Store;
      return memoryStore!;
    }
  } catch {
    // fall through
  }
  memoryStore = seedStore();
  writeStore(memoryStore);
  return memoryStore;
}

function writeStore(store: Store): void {
  memoryStore = store;
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore
  }
}

function appendAudit(entry: Omit<PmAuditEntry, "id" | "timestamp">): void {
  const store = readStore();
  store.audit = [
    {
      ...entry,
      id: `pmaudit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
    },
    ...store.audit,
  ].slice(0, 3000);
  writeStore(store);
}

export function resetPmIntelligenceForTests(): void {
  memoryStore = seedStore();
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(STORAGE_KEY);
  }
}

export function getPmSettings(): PmSettings {
  return readStore().settings;
}

export function updatePmSettings(
  patch: Partial<PmSettings>,
  updatedBy: string,
): PmSettings {
  const store = readStore();
  const previous = { ...store.settings };
  store.settings = {
    ...store.settings,
    ...patch,
    updatedAt: new Date().toISOString(),
    updatedBy,
  };
  writeStore(store);
  appendAudit({
    user: updatedBy,
    action: "INTERVAL_SETTINGS_CHANGED",
    printerId: null,
    customerName: null,
    previousValue: JSON.stringify(previous),
    newValue: JSON.stringify(store.settings),
    reason: "PM settings updated",
    sourceModule: "pm-settings",
    device: "web",
    ipAddress: "0.0.0.0",
    workOrderId: null,
    pmEventId: null,
  });
  return store.settings;
}

export function listIntervalRules() {
  return readStore().intervalRules.filter((r) => r.active);
}

export function listCleaningRules() {
  return readStore().cleaningRules.filter((r) => r.active);
}

export function listPmPartsKits(): PmPartsKit[] {
  return readStore().partsKits;
}

export function getPmPartsKit(id: string): PmPartsKit | null {
  return readStore().partsKits.find((k) => k.id === id) ?? null;
}

export function listMeterTableRows(
  filters?: Partial<PmIntelligenceFilters>,
): MeterTableRow[] {
  const settings = getPmSettings();
  const profiles = listMaintenanceProfiles();
  const rows = profiles.map((p) =>
    buildMeterTableRow(p, listCopyCountHistory(p.printerId), settings),
  );
  return filters ? filterMeterRows(rows, filters) : rows;
}

export function listCleaningSchedule(): CleaningScheduleRow[] {
  return buildCleaningRowsFromProfiles(listMaintenanceProfiles());
}

export function getPmDashboard(filters?: Partial<PmIntelligenceFilters>) {
  const rows = listMeterTableRows(filters);
  const cleanings = listCleaningSchedule();
  const forecast = buildForecast(rows, cleanings, "30d", listIntervalRules());
  const metrics = buildDashboardMetrics(
    rows,
    cleanings,
    forecast.items,
    getPmSettings(),
  );
  return { metrics, rows, cleanings, forecast };
}

export function getMachineIntelligence(printerId: string) {
  const profile = listMaintenanceProfiles().find((p) => p.printerId === printerId);
  if (!profile) return null;
  const history = listCopyCountHistory(printerId);
  const settings = getPmSettings();
  const row = buildMeterTableRow(profile, history, settings);
  const cleanings = listCleaningSchedule().filter((c) => c.printerId === printerId);
  const health = computeMachineHealthScore(profile, {
    settings,
    countAgeDays: row.lastCountDate
      ? Math.floor(
          (Date.now() - new Date(row.lastCountDate).getTime()) / 86_400_000,
        )
      : 999,
    cleaningOverdue: cleanings.some((c) => c.status === "Overdue"),
  });
  const kit =
    listIntervalRules().find((r) => r.printerModel === profile.printerModel)
      ?.requiredPartsKitId ?? null;
  return {
    profile,
    row,
    health,
    cleanings,
    history: history.slice(0, 50),
    partsKit: kit ? getPmPartsKit(kit) : null,
    completions: listMaintenanceCompletions(printerId),
  };
}

export function enterMeterCount(input: {
  printerId: string;
  meterCount: number;
  recordedAt?: string;
  countTime?: string;
  operatingHours?: number | null;
  colorCount?: number | null;
  blackCount?: number | null;
  duplexCount?: number | null;
  scanCount?: number | null;
  notes?: string;
  source?: MeterReading["source"];
  enteredBy: string;
  photoUrl?: string | null;
  overrideReason?: string;
}):
  | { ok: true; reading: MeterReading; warnings: string[] }
  | { ok: false; error: string; requiresOverride?: boolean; warnings: string[] } {
  const profile = listMaintenanceProfiles().find((p) => p.printerId === input.printerId);
  if (!profile) return { ok: false, error: "Machine not found.", warnings: [] };

  const store = readStore();
  const existing = store.readings.filter((r) => r.printerId === input.printerId);
  const history = listCopyCountHistory(input.printerId);
  const row = buildMeterTableRow(profile, history, store.settings);
  const recordedAt = input.recordedAt ?? new Date().toISOString();

  const validation = validateMeterCount({
    newCount: input.meterCount,
    previousCount: profile.currentCopyCount,
    avgDailyVolume: row.avgDailyVolume,
    unusualIncreaseMultiplier: store.settings.unusualIncreaseMultiplier,
    overrideReason: input.overrideReason,
    recordedAt,
    existingReadings: existing,
  });

  if (!validation.ok) {
    return {
      ok: false,
      error: validation.error,
      requiresOverride: validation.requiresOverride,
      warnings: validation.warnings,
    };
  }

  const maint = recordCopyCount({
    printerId: input.printerId,
    copyCount: input.meterCount,
    enteredBy: input.enteredBy,
    notes: input.notes ?? "",
    lowerCountReason: input.overrideReason ?? undefined,
  });
  if (!maint.ok) {
    return { ok: false, error: maint.error, warnings: validation.warnings };
  }

  const reading = buildMeterReading({
    printerId: input.printerId,
    meterCount: input.meterCount,
    previousCount: profile.currentCopyCount,
    recordedAt,
    countTime: input.countTime ?? new Date().toISOString().slice(11, 16),
    operatingHours: input.operatingHours,
    colorCount: input.colorCount,
    blackCount: input.blackCount,
    duplexCount: input.duplexCount,
    scanCount: input.scanCount,
    notes: input.notes ?? "",
    source: input.source ?? "Manual Entry",
    enteredBy: input.enteredBy,
    photoUrl: input.photoUrl,
    validationOverrideReason: input.overrideReason ?? null,
    suspectedReset: validation.suspectedReset,
    unusualIncrease: validation.unusualIncrease,
  });

  store.readings = [reading, ...store.readings];
  writeStore(store);
  appendAudit({
    user: input.enteredBy,
    action: "METER_COUNT_ENTERED",
    printerId: input.printerId,
    customerName: profile.customerName,
    previousValue: String(profile.currentCopyCount ?? ""),
    newValue: String(input.meterCount),
    reason: input.overrideReason ?? null,
    sourceModule: "pm-counts",
    device: "web",
    ipAddress: "0.0.0.0",
    workOrderId: null,
    pmEventId: reading.id,
  });

  return { ok: true, reading, warnings: validation.warnings };
}

export function importMeterCsv(input: {
  csv: string;
  fileName: string;
  importedBy: string;
}): {
  ok: boolean;
  batch: MeterImportBatch;
  imported: number;
} {
  const parsed = parseMeterCsv(input.csv);
  let success = 0;
  const errors = [...parsed.errors];

  for (const row of parsed.rows) {
    const result = enterMeterCount({
      printerId: row.printerId,
      meterCount: row.meterCount,
      recordedAt: row.recordedAt,
      enteredBy: row.enteredBy || input.importedBy,
      notes: row.notes,
      source: "CSV Import",
      overrideReason: "CSV import accepted",
    });
    if (result.ok) success += 1;
    else errors.push({ row: row.row, message: result.error });
  }

  const batch = createImportBatch({
    fileName: input.fileName,
    importedBy: input.importedBy,
    totalRows: parsed.rows.length,
    successCount: success,
    errors,
  });
  const store = readStore();
  store.imports = [batch, ...store.imports];
  writeStore(store);
  return { ok: errors.length === 0, batch, imported: success };
}

export function getMeterImportTemplate(): string {
  return meterImportTemplateCsv();
}

export function listMeterImports(): MeterImportBatch[] {
  return readStore().imports;
}

export function listPmScheduleRows(): PmScheduleRow[] {
  const schedules = listMaintenanceSchedules();
  const profiles = new Map(
    listMaintenanceProfiles().map((p) => [p.printerId, p]),
  );
  const rows = listMeterTableRows();
  const rowById = new Map(rows.map((r) => [r.printerId, r]));

  return schedules.map((s) => {
    const profile = profiles.get(s.printerId);
    const meter = rowById.get(s.printerId);
    const kitId = listIntervalRules().find(
      (r) => r.printerModel === (profile?.printerModel ?? ""),
    )?.requiredPartsKitId;
    const kit = kitId ? getPmPartsKit(kitId) : null;
    const priorityMap: Record<string, PmScheduleRow["priority"]> = {
      LOW: "LOW",
      NORMAL: "NORMAL",
      HIGH: "HIGH",
      URGENT: "CRITICAL",
    };
    return {
      id: s.id,
      scheduledDate: s.scheduledDate,
      customerName: s.customerName || profile?.customerName || "",
      siteName: s.siteName || profile?.siteName || "",
      machineName: s.printerName || profile?.nickname || s.printerId,
      printerId: s.printerId,
      printerModel: profile?.printerModel ?? "",
      currentCount: meter?.currentMeter ?? null,
      pmDueCount: meter?.nextPmCount ?? null,
      remainingOrOverdue: meter?.impressionsRemaining ?? null,
      estimatedLaborHours: s.expectedDurationHours,
      assignedTechnician: s.technician || null,
      requiredParts: kit?.requiredParts.map((p) => p.partNumber) ?? [],
      partsAvailability: kit
        ? assessPartsAvailability(kit)
        : ("Unknown" as const),
      workOrderId: null,
      status: meter?.pmStatus ?? "Not Enough Data",
      priority: priorityMap[s.priority] ?? "NORMAL",
    };
  });
}

function assessPartsAvailability(
  kit: PmPartsKit,
): "Available" | "Partial" | "Missing" | "Unknown" {
  try {
    const balances = listBalances("loc-main");
    const total = kit.requiredParts.length;
    if (total === 0) return "Available";
    let found = 0;
    for (const part of kit.requiredParts) {
      const bal = balances.find((b) => b.partNumber === part.partNumber);
      if (bal && bal.quantityOnHand >= part.quantity) found += 1;
    }
    if (found === total) return "Available";
    if (found === 0) return "Missing";
    return "Partial";
  } catch {
    return "Unknown";
  }
}

export function createPmSchedule(input: {
  printerId: string;
  scheduledDate: string;
  technician: string;
  priority?: PmScheduleRow["priority"];
  notes?: string;
  actor: string;
}): { ok: true; id: string } | { ok: false; error: string } {
  const profile = listMaintenanceProfiles().find((p) => p.printerId === input.printerId);
  if (!profile) return { ok: false, error: "Machine not found." };
  const priorityMap: Record<string, "LOW" | "NORMAL" | "HIGH" | "URGENT"> = {
    LOW: "LOW",
    NORMAL: "NORMAL",
    HIGH: "HIGH",
    CRITICAL: "URGENT",
  };
  const result = scheduleMaintenance({
    printerId: input.printerId,
    printerName: profile.nickname,
    customerName: profile.customerName,
    siteName: profile.siteName,
    kind: "PM",
    scheduledDate: input.scheduledDate,
    technician: input.technician,
    priority: priorityMap[input.priority ?? "NORMAL"] ?? "NORMAL",
    expectedDurationHours:
      listIntervalRules().find((r) => r.printerModel === profile.printerModel)
        ?.estimatedLaborHours ?? 2,
    notes: input.notes ?? "",
    createdBy: input.actor,
  });
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  appendAudit({
    user: input.actor,
    action: "PM_SCHEDULED",
    printerId: input.printerId,
    customerName: profile.customerName,
    previousValue: null,
    newValue: input.scheduledDate,
    reason: input.notes ?? null,
    sourceModule: "pm-schedule",
    device: "web",
    ipAddress: "0.0.0.0",
    workOrderId: null,
    pmEventId: result.event.id,
  });
  return { ok: true, id: result.event.id };
}

export function startPmCompletion(input: {
  printerId: string;
  scheduleId?: string | null;
  technician: string;
}): PmCompletionSession {
  const store = readStore();
  const session: PmCompletionSession = {
    id: `pmcomp-${Date.now()}`,
    printerId: input.printerId,
    scheduleId: input.scheduleId ?? null,
    step: 1,
    startingMeter: null,
    endingMeter: null,
    checklist: defaultPmChecklist(
      listMaintenanceProfiles().find((p) => p.printerId === input.printerId)
        ?.printerModel ?? "Unknown",
    ),
    partsUsed: [],
    cleaningTypes: [],
    notes: "",
    photos: [],
    technician: input.technician,
    customerAck: null,
    status: "IN_PROGRESS",
    startedAt: new Date().toISOString(),
    completedAt: null,
  };
  store.completionSessions = [session, ...store.completionSessions];
  writeStore(store);
  return session;
}

export function updatePmCompletionSession(
  session: PmCompletionSession,
): PmCompletionSession {
  const store = readStore();
  const idx = store.completionSessions.findIndex((s) => s.id === session.id);
  if (idx >= 0) {
    store.completionSessions[idx] = session;
    writeStore(store);
  }
  return session;
}

export function finalizePmCompletion(
  sessionId: string,
):
  | { ok: true; session: PmCompletionSession }
  | { ok: false; error: string } {
  const store = readStore();
  const idx = store.completionSessions.findIndex((s) => s.id === sessionId);
  if (idx < 0) return { ok: false, error: "Session not found." };
  const session = store.completionSessions[idx];
  if (session.status !== "IN_PROGRESS") {
    return { ok: false, error: "Session is not in progress." };
  }
  if (session.endingMeter == null) {
    return { ok: false, error: "Ending meter count is required." };
  }
  const requiredPending = session.checklist.filter(
    (c) => c.required && c.completionStatus === "PENDING",
  );
  if (requiredPending.length) {
    return { ok: false, error: "Complete all required checklist items." };
  }

  const maint = completeMaintenance({
    printerId: session.printerId,
    kind: "PM",
    completedAt: new Date().toISOString(),
    copyCountAtCompletion: session.endingMeter,
    technician: session.technician,
    notes: session.notes,
    workPerformed: "PM completed via intelligence workflow",
  });
  if (!maint.ok) {
    return { ok: false, error: maint.error };
  }

  // Inventory deductions for parts used
  for (const part of session.partsUsed) {
    const balances = listBalances("loc-main");
    const bal = balances.find((b) => b.partNumber === part.partNumber);
    if (!bal) continue;
    const txn = postTransaction({
      type: "CONSUME",
      partId: bal.partId,
      quantity: part.quantity,
      reason: `PM completion ${session.id}`,
      user: session.technician,
      sourceLocationId: "loc-main",
    });
    if (!txn.ok) {
      return {
        ok: false,
        error: `Inventory deduction failed for ${part.partNumber}: ${txn.error}`,
      };
    }
  }

  for (const cleaningType of session.cleaningTypes) {
    const kind =
      cleaningType === "DTF"
        ? "DTF_PM"
        : cleaningType === "JOINT_UNIT"
          ? "JOINT_UNIT"
          : "CLEANING";
    completeMaintenance({
      printerId: session.printerId,
      kind,
      completedAt: new Date().toISOString(),
      copyCountAtCompletion: session.endingMeter,
      technician: session.technician,
      notes: `${cleaningType} during PM`,
      workPerformed: "Cleaning during PM",
    });
  }

  const completed: PmCompletionSession = {
    ...session,
    status: "COMPLETED",
    completedAt: new Date().toISOString(),
    step: 13,
  };
  store.completionSessions[idx] = completed;
  writeStore(store);

  appendAudit({
    user: session.technician,
    action: "PM_COMPLETED",
    printerId: session.printerId,
    customerName:
      listMaintenanceProfiles().find((p) => p.printerId === session.printerId)
        ?.customerName ?? null,
    previousValue: String(session.startingMeter ?? ""),
    newValue: String(session.endingMeter),
    reason: null,
    sourceModule: "pm-completion",
    device: "web",
    ipAddress: "0.0.0.0",
    workOrderId: null,
    pmEventId: session.id,
  });

  return { ok: true, session: completed };
}

export function completeCleaning(input: {
  printerId: string;
  cleaningType: CleaningTypeId;
  completedMeter: number;
  technician: string;
  timeSpentMinutes: number;
  conditionBefore: string;
  conditionAfter: string;
  notes: string;
  followUpRequired?: boolean;
}):
  | { ok: true; completion: CleaningCompletion }
  | { ok: false; error: string } {
  const kind =
    input.cleaningType === "DTF"
      ? "DTF_PM"
      : input.cleaningType === "JOINT_UNIT"
        ? "JOINT_UNIT"
        : "CLEANING";
  const maint = completeMaintenance({
    printerId: input.printerId,
    kind,
    completedAt: new Date().toISOString(),
    copyCountAtCompletion: input.completedMeter,
    technician: input.technician,
    notes: input.notes,
    workPerformed: `${input.cleaningType} cleaning`,
  });
  if (!maint.ok) {
    return { ok: false, error: maint.error };
  }

  const interval = listCleaningRules().find(
    (r) => r.cleaningType === input.cleaningType,
  );
  const nextCount =
    interval?.impressionInterval != null
      ? input.completedMeter + interval.impressionInterval
      : null;

  const completion: CleaningCompletion = {
    id: `clcomp-${Date.now()}`,
    printerId: input.printerId,
    cleaningType: input.cleaningType,
    completedAt: new Date().toISOString(),
    completedMeter: input.completedMeter,
    technician: input.technician,
    timeSpentMinutes: input.timeSpentMinutes,
    conditionBefore: input.conditionBefore,
    conditionAfter: input.conditionAfter,
    suppliesUsed: [],
    partsUsed: [],
    photos: [],
    notes: input.notes,
    customerSignature: null,
    followUpRequired: input.followUpRequired ?? false,
    nextCleaningCount: nextCount,
    nextCleaningDate: null,
  };
  const store = readStore();
  store.cleanings = [completion, ...store.cleanings];
  writeStore(store);
  appendAudit({
    user: input.technician,
    action: "CLEANING_COMPLETED",
    printerId: input.printerId,
    customerName: null,
    previousValue: null,
    newValue: String(input.completedMeter),
    reason: input.cleaningType,
    sourceModule: "pm-cleanings",
    device: "web",
    ipAddress: "0.0.0.0",
    workOrderId: null,
    pmEventId: completion.id,
  });
  return { ok: true, completion };
}

export function listPmHistory(): PmHistoryRow[] {
  const profiles = new Map(
    listMaintenanceProfiles().map((p) => [p.printerId, p]),
  );
  return listAllMaintenanceCompletions().map((c) => {
    const p = profiles.get(c.printerId);
    return {
      id: c.id,
      completionDate: c.completedAt.slice(0, 10),
      customerName: p?.customerName ?? "",
      siteName: p?.siteName ?? "",
      machineName: p?.nickname ?? c.printerId,
      serialNumber: c.printerId,
      printerModel: p?.printerModel ?? "",
      pmType: c.kind,
      meterCount: c.copyCountAtCompletion,
      technician: c.technician,
      laborMinutes: 120,
      partsUsed: [],
      cleaningPerformed: c.kind !== "PM",
      workOrderNumber: null,
      result: "Completed",
      followUpRequired: false,
      reportId: null,
    };
  });
}

export function getForecast(window: ForecastWindow = "30d") {
  return buildForecast(
    listMeterTableRows(),
    listCleaningSchedule(),
    window,
    listIntervalRules(),
  );
}

export function listPmAudit(limit = 100): PmAuditEntry[] {
  return readStore().audit.slice(0, limit);
}

export function listSiteVisitPlan(siteName: string) {
  const rows = listMeterTableRows().filter((r) => r.siteName === siteName);
  const cleanings = listCleaningSchedule().filter((c) => c.siteName === siteName);
  return {
    siteName,
    dueMachines: rows.filter((r) =>
      ["Due", "Due Soon", "Critical", "Overdue", "Severely Overdue"].includes(
        r.pmStatus,
      ),
    ),
    cleaningsDue: cleanings.filter((c) =>
      ["Due", "Due Soon", "Overdue"].includes(c.status),
    ),
    meterUpdatesNeeded: rows.filter((r) => !r.lastCountDate),
    allMachines: rows,
  };
}

export function exportPmHistoryCsv(): string {
  const rows = listPmHistory();
  const header =
    "Date,Customer,Site,Machine,Serial,Model,Type,Meter,Technician,Result";
  const lines = rows.map((r) =>
    [
      r.completionDate,
      r.customerName,
      r.siteName,
      r.machineName,
      r.serialNumber,
      r.printerModel,
      r.pmType,
      r.meterCount,
      r.technician,
      r.result,
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  return [header, ...lines].join("\n");
}

export function getExecutiveShowcase() {
  const { metrics, rows, forecast } = getPmDashboard();
  const atRisk = rows
    .filter((r) =>
      ["Critical", "Overdue", "Severely Overdue", "Due"].includes(r.pmStatus),
    )
    .slice(0, 10);
  const sites = [...new Set(atRisk.map((r) => r.siteName))];
  return {
    fleetCompliance: metrics.pmCompliancePercent,
    machinesAtRisk: atRisk.length,
    workloadNext30: forecast.estimatedLaborHours,
    estimatedDowntimePreventedHours: Math.round(
      metrics.estimatedPmsNext30Days * 1.5,
    ),
    preventiveVsReactiveLabel:
      "Estimate based on scheduled PM volume vs reactive ticket volume is not linked in this build — PM forecast hours shown only.",
    overdueCount: metrics.overduePms,
    partsReadiness: listPmScheduleRows().filter(
      (s) => s.partsAvailability === "Available",
    ).length,
    technicianCapacityHours: forecast.estimatedLaborHours,
    sitesRequiringAttention: sites,
    highestRisk: atRisk,
    metrics,
  };
}

export function listProfiles(): PrinterMaintenanceProfile[] {
  return listMaintenanceProfiles();
}
