import {
  recalculateDueCounts,
  validateWholeNonNegativeCount,
} from "./calculations";
import {
  sampleCopyCountHistory,
  sampleMaintenanceCompletions,
  sampleMaintenanceProfiles,
  sampleMaintenanceTimeline,
} from "./data";
import { normalizePrinterId } from "./helpers";
import {
  defaultMaintenanceIntervals,
  getDefaultIntervalForModel,
  resolvePrinterModelKey,
} from "./intervals";
import type {
  MaintenanceAuditEntry,
  MaintenanceScheduleEvent,
  ScheduleMaintenanceInput,
  UpdateScheduleInput,
} from "./scheduling";
import type {
  CompleteMaintenanceInput,
  CopyCountHistory,
  InitialBaselineInput,
  MaintenanceCompletionRecord,
  MaintenanceCorrectionInput,
  MaintenanceEventType,
  MaintenanceIntervalConfig,
  MaintenanceKind,
  MaintenanceTimelineEvent,
  PrinterMaintenanceProfile,
  RecordCopyCountInput,
  UpdateIntervalInput,
} from "./types";

const PROFILE_KEY = "matrix.maintenance.profiles.v2";
const HISTORY_KEY = "matrix.maintenance.copy-history.v2";
const TIMELINE_KEY = "matrix.maintenance.timeline.v2";
const COMPLETIONS_KEY = "matrix.maintenance.completions.v2";
const INTERVALS_KEY = "matrix.maintenance.intervals.v2";
const SCHEDULE_KEY = "matrix.maintenance.schedules.v1";
const AUDIT_KEY = "matrix.maintenance.audit.v1";

let profilesStore: PrinterMaintenanceProfile[] | null = null;
let historyStore: CopyCountHistory[] | null = null;
let timelineStore: MaintenanceTimelineEvent[] | null = null;
let completionsStore: MaintenanceCompletionRecord[] | null = null;
let intervalsStore: MaintenanceIntervalConfig[] | null = null;
let scheduleStore: MaintenanceScheduleEvent[] | null = null;
let auditStore: MaintenanceAuditEntry[] | null = null;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

function ensureProfiles(): PrinterMaintenanceProfile[] {
  if (profilesStore) return profilesStore;
  profilesStore =
    readJson<PrinterMaintenanceProfile[]>(PROFILE_KEY) ??
    clone(sampleMaintenanceProfiles);
  return profilesStore;
}

function ensureHistory(): CopyCountHistory[] {
  if (historyStore) return historyStore;
  historyStore =
    readJson<CopyCountHistory[]>(HISTORY_KEY) ?? clone(sampleCopyCountHistory);
  return historyStore;
}

function ensureTimeline(): MaintenanceTimelineEvent[] {
  if (timelineStore) return timelineStore;
  timelineStore =
    readJson<MaintenanceTimelineEvent[]>(TIMELINE_KEY) ??
    clone(sampleMaintenanceTimeline);
  return timelineStore;
}

function ensureCompletions(): MaintenanceCompletionRecord[] {
  if (completionsStore) return completionsStore;
  completionsStore =
    readJson<MaintenanceCompletionRecord[]>(COMPLETIONS_KEY) ??
    clone(sampleMaintenanceCompletions);
  return completionsStore;
}

function ensureIntervals(): MaintenanceIntervalConfig[] {
  if (intervalsStore) return intervalsStore;
  intervalsStore =
    readJson<MaintenanceIntervalConfig[]>(INTERVALS_KEY) ??
    clone(defaultMaintenanceIntervals);
  return intervalsStore;
}

function commitProfiles(next: PrinterMaintenanceProfile[]): void {
  profilesStore = next;
  writeJson(PROFILE_KEY, next);
}

function commitHistory(next: CopyCountHistory[]): void {
  historyStore = next;
  writeJson(HISTORY_KEY, next);
}

function commitTimeline(next: MaintenanceTimelineEvent[]): void {
  timelineStore = next;
  writeJson(TIMELINE_KEY, next);
}

function commitCompletions(next: MaintenanceCompletionRecord[]): void {
  completionsStore = next;
  writeJson(COMPLETIONS_KEY, next);
}

function commitIntervals(next: MaintenanceIntervalConfig[]): void {
  intervalsStore = next;
  writeJson(INTERVALS_KEY, next);
}

function sampleSchedules(): MaintenanceScheduleEvent[] {
  const today = new Date();
  const iso = (offset: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
  };
  return [
    {
      id: "msch-001",
      printerId: "MX-GD-002",
      printerName: "Press Room GD",
      customerName: "SFX / MPX",
      siteName: "Chicago HQ",
      kind: "PM",
      scheduledDate: iso(1),
      technician: "Toby Tompkins",
      priority: "HIGH",
      expectedDurationHours: 3,
      notes: "Scheduled from fleet planning center",
      createdAt: new Date().toISOString(),
      createdBy: "Matrix Planner",
      updatedAt: new Date().toISOString(),
    },
    {
      id: "msch-002",
      printerId: "MX-GD-001",
      printerName: "Main GD",
      customerName: "SFX / MPX",
      siteName: "Chicago HQ",
      kind: "CLEANING",
      scheduledDate: iso(0),
      technician: "Toby Tompkins",
      priority: "NORMAL",
      expectedDurationHours: 1.5,
      notes: "Routine cleaning window",
      createdAt: new Date().toISOString(),
      createdBy: "Matrix Planner",
      updatedAt: new Date().toISOString(),
    },
    {
      id: "msch-003",
      printerId: "MX-GL-001",
      printerName: "GL Production",
      customerName: "SFX / MPX",
      siteName: "Dallas Plant",
      kind: "JOINT_UNIT",
      scheduledDate: iso(5),
      technician: "Field Tech B",
      priority: "URGENT",
      expectedDurationHours: 4,
      notes: "Joint unit PM planning",
      createdAt: new Date().toISOString(),
      createdBy: "Matrix Planner",
      updatedAt: new Date().toISOString(),
    },
  ];
}

function ensureSchedules(): MaintenanceScheduleEvent[] {
  if (scheduleStore) return scheduleStore;
  scheduleStore =
    readJson<MaintenanceScheduleEvent[]>(SCHEDULE_KEY) ?? sampleSchedules();
  return scheduleStore;
}

function ensureAudit(): MaintenanceAuditEntry[] {
  if (auditStore) return auditStore;
  auditStore = readJson<MaintenanceAuditEntry[]>(AUDIT_KEY) ?? [];
  return auditStore;
}

function commitSchedules(next: MaintenanceScheduleEvent[]): void {
  scheduleStore = next;
  writeJson(SCHEDULE_KEY, next);
}

function commitAudit(next: MaintenanceAuditEntry[]): void {
  auditStore = next;
  writeJson(AUDIT_KEY, next);
}

function pushAudit(
  entry: Omit<MaintenanceAuditEntry, "id" | "occurredAt"> & {
    id?: string;
    occurredAt?: string;
  },
): void {
  const full: MaintenanceAuditEntry = {
    id: entry.id ?? `aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    action: entry.action,
    actor: entry.actor,
    occurredAt: entry.occurredAt ?? new Date().toISOString(),
    printerId: entry.printerId ?? null,
    details: entry.details,
    previousValue: entry.previousValue ?? null,
    newValue: entry.newValue ?? null,
  };
  commitAudit([full, ...ensureAudit()]);
}

function findProfileIndex(printerId: string): number {
  const id = normalizePrinterId(printerId);
  return ensureProfiles().findIndex(
    (p) =>
      normalizePrinterId(p.printerId) === id ||
      normalizePrinterId(p.assetTag) === id,
  );
}

function withRecalculated(
  profile: PrinterMaintenanceProfile,
): PrinterMaintenanceProfile {
  const intervals = getIntervalConfig(profile.printerModel);
  return { ...profile, ...recalculateDueCounts(profile, intervals) };
}

function pushTimeline(
  event: Omit<MaintenanceTimelineEvent, "id"> & { id?: string },
): void {
  const entry: MaintenanceTimelineEvent = {
    id: event.id ?? `mtl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    printerId: event.printerId,
    type: event.type,
    title: event.title,
    description: event.description,
    occurredAt: event.occurredAt,
    actor: event.actor,
    copyCount: event.copyCount,
    previousValue: event.previousValue,
    newValue: event.newValue,
    notes: event.notes,
  };
  commitTimeline([entry, ...ensureTimeline()]);
}

function eventTypeForKind(kind: MaintenanceKind): MaintenanceEventType {
  switch (kind) {
    case "PM":
      return "PM_COMPLETED";
    case "CLEANING":
      return "CLEANING_COMPLETED";
    case "JOINT_UNIT":
      return "JOINT_UNIT";
    case "DTF_PM":
      return "DTF_PM";
  }
}

export function listMaintenanceProfiles(): PrinterMaintenanceProfile[] {
  return clone(ensureProfiles());
}

export function getMaintenanceProfile(
  printerId: string,
): PrinterMaintenanceProfile | undefined {
  const idx = findProfileIndex(printerId);
  if (idx < 0) return undefined;
  return clone(withRecalculated(ensureProfiles()[idx]));
}

export function listCopyCountHistory(printerId: string): CopyCountHistory[] {
  const id = normalizePrinterId(printerId);
  return ensureHistory()
    .filter((h) => normalizePrinterId(h.printerId) === id)
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
}

export function listMaintenanceTimeline(
  printerId: string,
): MaintenanceTimelineEvent[] {
  const id = normalizePrinterId(printerId);
  return ensureTimeline()
    .filter((e) => normalizePrinterId(e.printerId) === id)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

export function listMaintenanceCompletions(
  printerId: string,
): MaintenanceCompletionRecord[] {
  const id = normalizePrinterId(printerId);
  return ensureCompletions()
    .filter((c) => normalizePrinterId(c.printerId) === id)
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
}

export function listAllMaintenanceCompletions(): MaintenanceCompletionRecord[] {
  return clone(ensureCompletions()).sort((a, b) =>
    b.completedAt.localeCompare(a.completedAt),
  );
}

export function listMaintenanceSchedules(): MaintenanceScheduleEvent[] {
  return clone(ensureSchedules()).sort((a, b) =>
    a.scheduledDate.localeCompare(b.scheduledDate),
  );
}

export function listMaintenanceAudit(): MaintenanceAuditEntry[] {
  return clone(ensureAudit()).sort((a, b) =>
    b.occurredAt.localeCompare(a.occurredAt),
  );
}

export function recordMaintenanceAudit(
  entry: Omit<MaintenanceAuditEntry, "id" | "occurredAt"> & {
    occurredAt?: string;
  },
): MaintenanceAuditEntry {
  pushAudit(entry);
  return clone(ensureAudit()[0]);
}

export function scheduleMaintenance(
  input: ScheduleMaintenanceInput,
):
  | { ok: true; event: MaintenanceScheduleEvent }
  | { ok: false; error: string } {
  if (!input.scheduledDate) {
    return { ok: false, error: "Scheduled date is required." };
  }
  if (!input.technician.trim()) {
    return { ok: false, error: "Technician is required." };
  }
  const now = new Date().toISOString();
  const event: MaintenanceScheduleEvent = {
    id: `msch-${Date.now()}`,
    printerId: input.printerId,
    printerName: input.printerName,
    customerName: input.customerName,
    siteName: input.siteName,
    kind: input.kind,
    scheduledDate: input.scheduledDate.slice(0, 10),
    technician: input.technician.trim(),
    priority: input.priority,
    expectedDurationHours: input.expectedDurationHours || 2,
    notes: input.notes.trim(),
    createdAt: now,
    createdBy: input.createdBy || "Matrix User",
    updatedAt: now,
  };
  commitSchedules([event, ...ensureSchedules()]);
  pushAudit({
    action: "SCHEDULE_CREATED",
    actor: event.createdBy,
    printerId: event.printerId,
    details: `Scheduled ${event.kind} for ${event.printerName} on ${event.scheduledDate}`,
    newValue: JSON.stringify(event),
  });
  return { ok: true, event: clone(event) };
}

export function updateMaintenanceSchedule(
  input: UpdateScheduleInput,
):
  | { ok: true; event: MaintenanceScheduleEvent }
  | { ok: false; error: string } {
  const list = ensureSchedules();
  const idx = list.findIndex((e) => e.id === input.id);
  if (idx < 0) return { ok: false, error: "Schedule not found." };
  const previous = list[idx];
  const next: MaintenanceScheduleEvent = {
    ...previous,
    scheduledDate: input.scheduledDate
      ? input.scheduledDate.slice(0, 10)
      : previous.scheduledDate,
    technician: input.technician?.trim() || previous.technician,
    priority: input.priority ?? previous.priority,
    expectedDurationHours:
      input.expectedDurationHours ?? previous.expectedDurationHours,
    notes: input.notes ?? previous.notes,
    updatedAt: new Date().toISOString(),
  };
  const updated = [...list];
  updated[idx] = next;
  commitSchedules(updated);

  const moved = previous.scheduledDate !== next.scheduledDate;
  const assigned = previous.technician !== next.technician;
  pushAudit({
    action: moved
      ? "SCHEDULE_MOVED"
      : assigned
        ? "ASSIGNMENT_CHANGED"
        : "SCHEDULE_UPDATED",
    actor: input.changedBy,
    printerId: next.printerId,
    details: `Updated schedule ${next.id}`,
    previousValue: JSON.stringify(previous),
    newValue: JSON.stringify(next),
  });
  return { ok: true, event: clone(next) };
}

export function listIntervalConfigs(): MaintenanceIntervalConfig[] {
  return clone(ensureIntervals());
}

export function getIntervalConfig(printerModel: string): MaintenanceIntervalConfig {
  const key = resolvePrinterModelKey(printerModel);
  const found = ensureIntervals().find((c) => c.printerModel === key);
  return clone(found ?? getDefaultIntervalForModel(printerModel));
}

export function recordCopyCount(
  input: RecordCopyCountInput,
):
  | { ok: true; profile: PrinterMaintenanceProfile; history: CopyCountHistory }
  | { ok: false; error: string } {
  const validated = validateWholeNonNegativeCount(input.copyCount);
  if (!validated.ok) return validated;

  const profiles = ensureProfiles();
  const idx = findProfileIndex(input.printerId);
  if (idx < 0) {
    return { ok: false, error: `Printer not found: ${input.printerId}` };
  }

  const existing = profiles[idx];
  const previous = existing.currentCopyCount;
  if (
    previous !== null &&
    validated.value < previous &&
    !input.lowerCountReason?.trim()
  ) {
    return {
      ok: false,
      error:
        "New count is lower than the previous count. Provide a reason before saving.",
    };
  }

  const now = new Date().toISOString();
  const historyEntry: CopyCountHistory = {
    id: `cch-${Date.now()}`,
    printerId: existing.printerId,
    recordedAt: now,
    copyCount: validated.value,
    enteredBy: input.enteredBy || "Matrix User",
    notes: input.notes.trim(),
    previousCount: previous,
    lowerCountReason: input.lowerCountReason?.trim() || null,
  };

  const updated = withRecalculated({
    ...existing,
    previousCopyCount: previous,
    currentCopyCount: validated.value,
  });

  const nextProfiles = [...profiles];
  nextProfiles[idx] = updated;
  commitProfiles(nextProfiles);
  commitHistory([historyEntry, ...ensureHistory()]);

  pushTimeline({
    printerId: existing.printerId,
    type: "COPY_COUNT_ENTERED",
    title: "Copy Count Entered",
    description: `Meter reading recorded at ${validated.value.toLocaleString("en-US")}`,
    occurredAt: now,
    actor: historyEntry.enteredBy,
    copyCount: validated.value,
    previousValue: previous === null ? null : String(previous),
    newValue: String(validated.value),
    notes: historyEntry.lowerCountReason || historyEntry.notes || null,
  });

  pushAudit({
    action: "COPY_COUNT_ENTERED",
    actor: historyEntry.enteredBy,
    printerId: existing.printerId,
    details: `Copy count ${validated.value}`,
    previousValue: previous === null ? null : String(previous),
    newValue: String(validated.value),
  });

  return { ok: true, profile: clone(updated), history: historyEntry };
}

export function completeMaintenance(
  input: CompleteMaintenanceInput,
):
  | {
      ok: true;
      profile: PrinterMaintenanceProfile;
      completion: MaintenanceCompletionRecord;
    }
  | { ok: false; error: string } {
  const validated = validateWholeNonNegativeCount(input.copyCountAtCompletion);
  if (!validated.ok) return validated;
  if (!input.technician.trim()) {
    return { ok: false, error: "Technician is required." };
  }

  const profiles = ensureProfiles();
  const idx = findProfileIndex(input.printerId);
  if (idx < 0) {
    return { ok: false, error: `Printer not found: ${input.printerId}` };
  }

  const existing = profiles[idx];
  const completedAt = input.completedAt || new Date().toISOString();
  const completion: MaintenanceCompletionRecord = {
    id: `mch-${Date.now()}`,
    printerId: existing.printerId,
    kind: input.kind,
    completedAt,
    copyCountAtCompletion: validated.value,
    technician: input.technician.trim(),
    notes: input.notes.trim(),
    workPerformed: input.workPerformed.trim(),
  };

  let patched: PrinterMaintenanceProfile = { ...existing };
  switch (input.kind) {
    case "PM":
      patched = {
        ...patched,
        lastPMCopyCount: validated.value,
        lastPMDate: completedAt.slice(0, 10),
      };
      break;
    case "CLEANING":
      patched = {
        ...patched,
        lastCleaningCopyCount: validated.value,
        lastCleaningDate: completedAt.slice(0, 10),
      };
      break;
    case "JOINT_UNIT":
      patched = {
        ...patched,
        lastJointUnitCopyCount: validated.value,
        lastJointUnitDate: completedAt.slice(0, 10),
      };
      break;
    case "DTF_PM":
      patched = {
        ...patched,
        lastDTFPMCopyCount: validated.value,
        lastDTFPMDate: completedAt.slice(0, 10),
      };
      break;
  }

  const updated = withRecalculated(patched);
  const nextProfiles = [...profiles];
  nextProfiles[idx] = updated;
  commitProfiles(nextProfiles);
  commitCompletions([completion, ...ensureCompletions()]);

  const label =
    input.kind === "PM"
      ? "PM"
      : input.kind === "CLEANING"
        ? "Cleaning"
        : input.kind === "JOINT_UNIT"
          ? "Joint Unit PM"
          : "DTF PM";

  pushTimeline({
    printerId: existing.printerId,
    type: eventTypeForKind(input.kind),
    title: `${label} Completed`,
    description: `${label} completed at ${validated.value.toLocaleString("en-US")} copies`,
    occurredAt: completedAt,
    actor: completion.technician,
    copyCount: validated.value,
    notes: completion.notes || completion.workPerformed || null,
  });

  pushAudit({
    action: "MAINTENANCE_COMPLETED",
    actor: completion.technician,
    printerId: existing.printerId,
    details: `${input.kind} completed at ${validated.value} copies`,
    newValue: JSON.stringify(completion),
  });

  return { ok: true, profile: clone(updated), completion };
}

export function saveInitialBaseline(
  input: InitialBaselineInput,
):
  | { ok: true; profile: PrinterMaintenanceProfile }
  | { ok: false; error: string } {
  const profiles = ensureProfiles();
  const idx = findProfileIndex(input.printerId);
  if (idx < 0) {
    return { ok: false, error: `Printer not found: ${input.printerId}` };
  }

  const existing = profiles[idx];
  const counts = [
    input.lastPMCopyCount,
    input.lastCleaningCopyCount,
    input.lastJointUnitCopyCount,
    input.lastDTFPMCopyCount,
  ];
  for (const c of counts) {
    if (c === null || c === undefined) continue;
    const v = validateWholeNonNegativeCount(c);
    if (!v.ok) return v;
  }

  // Do not invent history for blank fields — only apply provided values.
  const patched: PrinterMaintenanceProfile = {
    ...existing,
    lastPMCopyCount:
      input.lastPMCopyCount !== null && input.lastPMCopyCount !== undefined
        ? input.lastPMCopyCount
        : existing.lastPMCopyCount,
    lastCleaningCopyCount:
      input.lastCleaningCopyCount !== null &&
      input.lastCleaningCopyCount !== undefined
        ? input.lastCleaningCopyCount
        : existing.lastCleaningCopyCount,
    lastJointUnitCopyCount:
      input.lastJointUnitCopyCount !== null &&
      input.lastJointUnitCopyCount !== undefined
        ? input.lastJointUnitCopyCount
        : existing.lastJointUnitCopyCount,
    lastDTFPMCopyCount:
      input.lastDTFPMCopyCount !== null && input.lastDTFPMCopyCount !== undefined
        ? input.lastDTFPMCopyCount
        : existing.lastDTFPMCopyCount,
    lastPMDate: input.lastPMDate || existing.lastPMDate,
    lastCleaningDate: input.lastCleaningDate || existing.lastCleaningDate,
    lastJointUnitDate: input.lastJointUnitDate || existing.lastJointUnitDate,
    lastDTFPMDate: input.lastDTFPMDate || existing.lastDTFPMDate,
  };

  const updated = withRecalculated(patched);
  const nextProfiles = [...profiles];
  nextProfiles[idx] = updated;
  commitProfiles(nextProfiles);

  const now = new Date().toISOString();
  pushTimeline({
    printerId: existing.printerId,
    type: "BASELINE_CHANGED",
    title: "Baseline Changed",
    description: "Initial maintenance baseline updated (no fake history created).",
    occurredAt: now,
    actor: input.enteredBy || "Matrix User",
    notes: input.notes.trim() || null,
    previousValue: JSON.stringify({
      lastPMCopyCount: existing.lastPMCopyCount,
      lastCleaningCopyCount: existing.lastCleaningCopyCount,
      lastJointUnitCopyCount: existing.lastJointUnitCopyCount,
      lastDTFPMCopyCount: existing.lastDTFPMCopyCount,
    }),
    newValue: JSON.stringify({
      lastPMCopyCount: updated.lastPMCopyCount,
      lastCleaningCopyCount: updated.lastCleaningCopyCount,
      lastJointUnitCopyCount: updated.lastJointUnitCopyCount,
      lastDTFPMCopyCount: updated.lastDTFPMCopyCount,
    }),
  });

  return { ok: true, profile: clone(updated) };
}

export function updateIntervalConfig(
  input: UpdateIntervalInput,
):
  | { ok: true; config: MaintenanceIntervalConfig }
  | { ok: false; error: string } {
  if (!input.reason.trim()) {
    return { ok: false, error: "A reason is required when changing intervals." };
  }

  const intervals = ensureIntervals();
  const key = resolvePrinterModelKey(input.printerModel);
  const idx = intervals.findIndex((c) => c.printerModel === key);
  const previous =
    idx >= 0 ? intervals[idx] : getDefaultIntervalForModel(input.printerModel);

  const next: MaintenanceIntervalConfig = {
    ...previous,
    ...input.patch,
    printerModel: key,
    notes: input.patch.notes ?? previous.notes,
  };

  const list = [...intervals];
  if (idx >= 0) list[idx] = next;
  else list.push(next);
  commitIntervals(list);

  // Recalculate all printers of this model
  const profiles = ensureProfiles().map((p) =>
    resolvePrinterModelKey(p.printerModel) === key ? withRecalculated(p) : p,
  );
  commitProfiles(profiles);

  pushTimeline({
    printerId: `MODEL:${key}`,
    type: "INTERVAL_CHANGED",
    title: "Interval Configuration Changed",
    description: `Intervals updated for model ${key}`,
    occurredAt: new Date().toISOString(),
    actor: input.changedBy,
    previousValue: JSON.stringify(previous),
    newValue: JSON.stringify(next),
    notes: input.reason.trim(),
  });

  return { ok: true, config: clone(next) };
}

export function recordMaintenanceCorrection(
  input: MaintenanceCorrectionInput,
): { ok: true } | { ok: false; error: string } {
  if (!input.reason.trim()) {
    return { ok: false, error: "Correction reason is required." };
  }
  const idx = findProfileIndex(input.printerId);
  if (idx < 0) return { ok: false, error: "Printer not found." };

  pushTimeline({
    printerId: ensureProfiles()[idx].printerId,
    type: "MAINTENANCE_CORRECTED",
    title: "Maintenance Corrected",
    description: `Corrected ${input.field}`,
    occurredAt: new Date().toISOString(),
    actor: input.correctedBy,
    previousValue: input.originalValue,
    newValue: input.correctedValue,
    notes: input.reason.trim(),
  });

  return { ok: true };
}
