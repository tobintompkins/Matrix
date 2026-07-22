import {
  buildServiceCallFromInput,
  sampleServiceCalls,
} from "./data";
import {
  validateClosure,
  validateResolutionForResolve,
} from "./helpers";
import { assertServiceCallTransition } from "./workflow";
import type {
  CreateServiceCallInput,
  ServiceCall,
  ServiceCallActivity,
  ServiceCallNote,
  ServiceCallNoteType,
  ServiceCallPart,
  ServiceCallResolution,
  ServiceCallStatus,
} from "./types";

const STORAGE_KEY = "matrix.service-calls.v1";
const STORE_EVENT = "matrix-service-calls-changed";

let memoryStore: ServiceCall[] | null = null;
/** When false, reads return seed data so SSR and the first client paint match. */
let browserPersistenceEnabled = false;

function cloneCalls(calls: ServiceCall[]): ServiceCall[] {
  return structuredClone(calls);
}

function readSessionOverlay(): ServiceCall[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ServiceCall[];
  } catch {
    return null;
  }
}

function writeSessionOverlay(calls: ServiceCall[]): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(calls));
  } catch {
    // sessionStorage may be unavailable — keep in-memory only
  }
}

function notifyStoreChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(STORE_EVENT));
}

/**
 * Enable sessionStorage-backed service calls after React hydration.
 * Call once from ClientStoreHydration (root layout) inside useEffect.
 */
export function enableServiceCallBrowserPersistence(): void {
  if (typeof window === "undefined") return;
  if (browserPersistenceEnabled) return;
  browserPersistenceEnabled = true;
  memoryStore = null;
  notifyStoreChanged();
}

export function subscribeServiceCalls(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(STORE_EVENT, onStoreChange);
  return () => window.removeEventListener(STORE_EVENT, onStoreChange);
}

function ensureStore(): ServiceCall[] {
  // Browser pre-hydration: seed only (must match SSR; do not read sessionStorage yet).
  if (typeof window !== "undefined" && !browserPersistenceEnabled) {
    return cloneCalls(sampleServiceCalls);
  }
  if (memoryStore) return memoryStore;
  if (typeof window === "undefined") {
    // Node / SSR: in-memory seed (tests may mutate; each cold start gets sample).
    memoryStore = cloneCalls(sampleServiceCalls);
    return memoryStore;
  }
  const overlay = readSessionOverlay();
  memoryStore = overlay ? cloneCalls(overlay) : cloneCalls(sampleServiceCalls);
  return memoryStore;
}

function commit(next: ServiceCall[]): ServiceCall[] {
  // Ignore writes during the pre-hydration browser window (no clicks yet).
  if (typeof window !== "undefined" && !browserPersistenceEnabled) {
    return next;
  }
  memoryStore = next;
  writeSessionOverlay(next);
  notifyStoreChanged();
  return next;
}

export type ListServiceCallsOptions = {
  /** Include soft-deleted calls (admin / deleted-records only). */
  includeDeleted?: boolean;
  /** Include archived calls (default true for history; false for active workflows). */
  includeArchived?: boolean;
};

export function listServiceCalls(
  options: ListServiceCallsOptions = {},
): ServiceCall[] {
  const { includeDeleted = false, includeArchived = true } = options;
  return cloneCalls(ensureStore()).filter((call) => {
    const state = call.recordState ?? "ACTIVE";
    if (!includeDeleted && (state === "DELETED" || call.deletedAt)) return false;
    if (!includeArchived && (state === "ARCHIVED" || call.archivedAt))
      return false;
    return true;
  });
}

/** All calls including deleted — admin use only. */
export function listAllServiceCallsRaw(): ServiceCall[] {
  return cloneCalls(ensureStore());
}

export function getServiceCall(serviceCallId: string): ServiceCall | undefined {
  const normalized = serviceCallId.trim().toUpperCase();
  return ensureStore().find(
    (call) =>
      call.id.toUpperCase() === normalized ||
      call.workOrderNumber.toUpperCase() === normalized,
  );
}

export function createServiceCall(
  input: CreateServiceCallInput,
): { ok: true; call: ServiceCall } | { ok: false; error: string } {
  const store = ensureStore();
  const built = buildServiceCallFromInput(input, store);
  if ("error" in built) return { ok: false, error: built.error };
  commit([built, ...store]);
  return { ok: true, call: built };
}

export function replaceServiceCall(call: ServiceCall): ServiceCall | undefined {
  const store = ensureStore();
  const idx = store.findIndex((c) => c.id === call.id);
  if (idx < 0) return undefined;
  const next = [...store];
  next[idx] = { ...call, updatedAt: new Date().toISOString() };
  commit(next);
  return next[idx];
}

function pushActivity(
  call: ServiceCall,
  activityType: ServiceCallActivity["activityType"],
  description: string,
  user: string,
  metadata?: ServiceCallActivity["metadata"],
): ServiceCall {
  const timestamp = new Date().toISOString();
  const entry: ServiceCallActivity = {
    id: `act-${call.id}-${Date.now()}`,
    serviceCallId: call.id,
    activityType,
    description,
    user,
    timestamp,
    metadata,
  };
  return {
    ...call,
    updatedAt: timestamp,
    activity: [entry, ...call.activity],
  };
}

export function updateServiceCallStatus(
  serviceCallId: string,
  to: ServiceCallStatus,
  user: string,
): { ok: true; call: ServiceCall } | { ok: false; error: string } {
  const existing = getServiceCall(serviceCallId);
  if (!existing) return { ok: false, error: "Service call not found." };

  const gate = assertServiceCallTransition(existing.status, to);
  if (!gate.ok) return { ok: false, error: gate.message };

  if (to === "RESOLVED") {
    const err = validateResolutionForResolve(existing);
    if (err) return { ok: false, error: err };
  }
  if (to === "CLOSED") {
    const closeErr = validateClosure(existing);
    if (closeErr) return { ok: false, error: closeErr };
  }

  let next = pushActivity(
    existing,
    to === "ACCEPTED"
      ? "TECHNICIAN_ACCEPTED"
      : to === "EN_ROUTE"
        ? "TRAVEL_STARTED"
        : to === "ON_SITE"
          ? "ARRIVED_ON_SITE"
          : to === "WAITING_FOR_PARTS"
            ? "WAITING_FOR_PARTS"
            : to === "RESOLVED"
              ? "CALL_RESOLVED"
              : to === "CLOSED"
                ? "CALL_CLOSED"
                : "STATUS_CHANGED",
    `Status changed from ${existing.status} to ${to}`,
    user,
    { from: existing.status, to },
  );
  next = {
    ...next,
    status: to,
    closedAt: to === "CLOSED" ? new Date().toISOString() : next.closedAt,
  };

  const saved = replaceServiceCall(next);
  if (!saved) return { ok: false, error: "Failed to update service call." };
  return { ok: true, call: saved };
}

export function addServiceCallNote(
  serviceCallId: string,
  input: {
    author: string;
    noteType: ServiceCallNoteType;
    body: string;
    internalOnly: boolean;
  },
): { ok: true; call: ServiceCall } | { ok: false; error: string } {
  const existing = getServiceCall(serviceCallId);
  if (!existing) return { ok: false, error: "Service call not found." };
  if (!input.body.trim()) return { ok: false, error: "Note body is required." };

  const note: ServiceCallNote = {
    id: `scn-${serviceCallId}-${Date.now()}`,
    author: input.author,
    createdAt: new Date().toISOString(),
    noteType: input.noteType,
    body: input.body.trim(),
    internalOnly: input.internalOnly,
  };

  let next: ServiceCall = {
    ...existing,
    notes: [note, ...existing.notes],
  };
  next = pushActivity(
    next,
    "NOTE_ADDED",
    `Note added (${input.noteType})`,
    input.author,
    { internalOnly: input.internalOnly },
  );
  const saved = replaceServiceCall(next);
  if (!saved) return { ok: false, error: "Failed to save note." };
  return { ok: true, call: saved };
}

export function addServiceCallPart(
  serviceCallId: string,
  part: Omit<ServiceCallPart, "id">,
  user: string,
): { ok: true; call: ServiceCall } | { ok: false; error: string } {
  const existing = getServiceCall(serviceCallId);
  if (!existing) return { ok: false, error: "Service call not found." };

  const entry: ServiceCallPart = {
    ...part,
    id: `scp-${serviceCallId}-${Date.now()}`,
  };
  let next: ServiceCall = {
    ...existing,
    parts: [entry, ...existing.parts],
  };
  next = pushActivity(
    next,
    part.ordered ? "PART_ORDERED" : "PART_ADDED",
    `${part.ordered ? "Ordered" : "Added"} part ${part.partNumber}`,
    user,
    { partNumber: part.partNumber, emergency: part.emergency },
  );
  const saved = replaceServiceCall(next);
  if (!saved) return { ok: false, error: "Failed to add part." };
  return { ok: true, call: saved };
}

export function updateServiceCallResolution(
  serviceCallId: string,
  resolution: Partial<ServiceCallResolution>,
  user: string,
): { ok: true; call: ServiceCall } | { ok: false; error: string } {
  const existing = getServiceCall(serviceCallId);
  if (!existing) return { ok: false, error: "Service call not found." };

  let next: ServiceCall = {
    ...existing,
    resolution: { ...existing.resolution, ...resolution },
  };
  if (resolution.diagnosis) {
    next = pushActivity(next, "DIAGNOSIS_ADDED", "Diagnosis updated", user);
  }
  const saved = replaceServiceCall(next);
  if (!saved) return { ok: false, error: "Failed to update resolution." };
  return { ok: true, call: saved };
}

export function reassignServiceCall(
  serviceCallId: string,
  technician: string,
  user: string,
): { ok: true; call: ServiceCall } | { ok: false; error: string } {
  const existing = getServiceCall(serviceCallId);
  if (!existing) return { ok: false, error: "Service call not found." };
  if (!technician.trim())
    return { ok: false, error: "Technician name is required." };

  let next: ServiceCall = {
    ...existing,
    assignment: { ...existing.assignment, technician: technician.trim() },
    status:
      existing.status === "NEW" || existing.status === "UNASSIGNED"
        ? "ASSIGNED"
        : existing.status,
  };
  next = pushActivity(
    next,
    "CALL_ASSIGNED",
    `Reassigned to ${technician.trim()}`,
    user,
  );
  const saved = replaceServiceCall(next);
  if (!saved) return { ok: false, error: "Failed to reassign." };
  return { ok: true, call: saved };
}

export function getServiceCallsForMachine(machineId: string): ServiceCall[] {
  const normalized = machineId.trim().toUpperCase();
  return listServiceCalls().filter(
    (call) =>
      !call.isDraft &&
      (call.machine.machineId.toUpperCase() === normalized ||
        call.machine.assetTag.toUpperCase() === normalized),
  );
}

export function getOpenServiceCallsForMachine(machineId: string): ServiceCall[] {
  return getServiceCallsForMachine(machineId).filter(
    (call) =>
      call.status !== "CLOSED" &&
      call.status !== "CANCELLED" &&
      call.status !== "RESOLVED",
  );
}

export function getEmergencyCallForMachine(
  machineId: string,
): ServiceCall | undefined {
  return getOpenServiceCallsForMachine(machineId).find(
    (call) =>
      call.priority === "EMERGENCY" || call.problem.machineCurrentlyDown,
  );
}

export function getLastCompletedServiceCall(
  machineId: string,
): ServiceCall | undefined {
  return getServiceCallsForMachine(machineId)
    .filter((call) => call.status === "CLOSED" || call.status === "RESOLVED")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
}

export type MachineStatusOverride = {
  machineId: string;
  status: "DOWN" | "ONLINE" | "DEGRADED";
  alertTitle?: string;
  clearedAlert?: boolean;
};

const MACHINE_OVERRIDE_KEY = "matrix.service-calls.machine-overrides.v1";

export function setMachineStatusOverride(override: MachineStatusOverride): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.sessionStorage.getItem(MACHINE_OVERRIDE_KEY);
    const map = raw
      ? (JSON.parse(raw) as Record<string, MachineStatusOverride>)
      : {};
    map[override.machineId.toUpperCase()] = override;
    window.sessionStorage.setItem(MACHINE_OVERRIDE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function getMachineStatusOverride(
  machineId: string,
): MachineStatusOverride | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(MACHINE_OVERRIDE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, MachineStatusOverride>;
    return map[machineId.toUpperCase()] ?? null;
  } catch {
    return null;
  }
}
