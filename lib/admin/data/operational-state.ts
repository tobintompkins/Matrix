/**
 * Patch 49B — unified operational record lifecycle overlay.
 * Used for machines/meters/PM overlays and as a deleted-records index.
 * Service calls and CRM customers also embed lifecycle on the domain record.
 */

import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import type {
  AdminOperationalState,
  AdminRecordLifecycle,
  AdminRecordType,
  DeletionReasonKey,
} from "./types";
import { DEFAULT_SOFT_DELETE_RETENTION_DAYS } from "./types";

const STORAGE_KEY = "matrix.admin.operational-state.v1";

let memoryStore: AdminOperationalState[] | null = null;

function clone(rows: AdminOperationalState[]): AdminOperationalState[] {
  return structuredClone(rows);
}

function readSession(): AdminOperationalState[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AdminOperationalState[];
  } catch {
    return null;
  }
}

function writeSession(rows: AdminOperationalState[]): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  } catch {
    /* ignore */
  }
}

function ensureStore(): AdminOperationalState[] {
  if (memoryStore) return memoryStore;
  memoryStore = readSession() ?? [];
  return memoryStore;
}

function commit(next: AdminOperationalState[]): AdminOperationalState[] {
  memoryStore = next;
  writeSession(next);
  return next;
}

function stateKey(recordType: AdminRecordType, recordId: string) {
  return `${recordType}:${recordId}`;
}

export function getOperationalState(
  recordType: AdminRecordType,
  recordId: string,
): AdminOperationalState | null {
  const key = stateKey(recordType, recordId);
  return (
    ensureStore().find(
      (r) => stateKey(r.recordType, r.recordId) === key,
    ) ?? null
  );
}

export function listOperationalStates(filter?: {
  recordType?: AdminRecordType;
  lifecycle?: AdminRecordLifecycle;
  organizationId?: string;
}): AdminOperationalState[] {
  let rows = clone(ensureStore());
  if (filter?.recordType) {
    rows = rows.filter((r) => r.recordType === filter.recordType);
  }
  if (filter?.lifecycle) {
    rows = rows.filter((r) => r.lifecycle === filter.lifecycle);
  }
  if (filter?.organizationId) {
    rows = rows.filter((r) => r.organizationId === filter.organizationId);
  }
  return rows.sort((a, b) =>
    (b.deletedAt ?? b.archivedAt ?? b.updatedAt).localeCompare(
      a.deletedAt ?? a.archivedAt ?? a.updatedAt,
    ),
  );
}

export function upsertOperationalState(
  partial: Omit<AdminOperationalState, "updatedAt" | "updatedAtVersion"> & {
    updatedAtVersion?: number;
  },
): AdminOperationalState {
  const store = ensureStore();
  const idx = store.findIndex(
    (r) =>
      r.recordType === partial.recordType && r.recordId === partial.recordId,
  );
  const now = new Date().toISOString();
  const nextRow: AdminOperationalState = {
    ...partial,
    organizationId: partial.organizationId || DEFAULT_ORG_ID,
    updatedAtVersion:
      (partial.updatedAtVersion ??
        (idx >= 0 ? store[idx].updatedAtVersion : 0)) + 1,
    updatedAt: now,
  };
  const next = [...store];
  if (idx >= 0) next[idx] = nextRow;
  else next.push(nextRow);
  commit(next);
  return nextRow;
}

export function archiveOperationalRecord(input: {
  recordType: AdminRecordType;
  recordId: string;
  actorUserId: string;
  actorName: string;
  reason: string;
  organizationId?: string;
  displayName?: string;
  customerName?: string;
  machineName?: string;
  expectedVersion?: number;
}):
  | { ok: true; state: AdminOperationalState }
  | { ok: false; error: string } {
  const existing = getOperationalState(input.recordType, input.recordId);
  if (existing?.lifecycle === "DELETED") {
    return {
      ok: false,
      error: "Deleted records cannot be archived. Restore first.",
    };
  }
  if (
    input.expectedVersion != null &&
    existing &&
    existing.updatedAtVersion !== input.expectedVersion
  ) {
    return {
      ok: false,
      error:
        "This record changed after you opened it. Refresh and review the latest information before continuing.",
    };
  }
  const state = upsertOperationalState({
    recordType: input.recordType,
    recordId: input.recordId,
    lifecycle: "ARCHIVED",
    organizationId: input.organizationId ?? DEFAULT_ORG_ID,
    previousLifecycle: existing?.lifecycle ?? "ACTIVE",
    archivedAt: new Date().toISOString(),
    archivedByUserId: input.actorUserId,
    archivedByName: input.actorName,
    archiveReason: input.reason,
    deletedAt: null,
    deletedByUserId: null,
    deletionReason: null,
    deletionNotes: null,
    displayName: input.displayName ?? existing?.displayName,
    customerName: input.customerName ?? existing?.customerName,
    machineName: input.machineName ?? existing?.machineName,
    updatedAtVersion: existing?.updatedAtVersion,
  });
  return { ok: true, state };
}

export function softDeleteOperationalRecord(input: {
  recordType: AdminRecordType;
  recordId: string;
  actorUserId: string;
  actorName: string;
  reason: DeletionReasonKey | string;
  notes?: string | null;
  organizationId?: string;
  displayName?: string;
  customerName?: string;
  machineName?: string;
  expectedVersion?: number;
}):
  | { ok: true; state: AdminOperationalState }
  | { ok: false; error: string } {
  const existing = getOperationalState(input.recordType, input.recordId);
  if (existing?.lifecycle === "DELETED") {
    return { ok: false, error: "This record is already deleted." };
  }
  if (
    input.expectedVersion != null &&
    existing &&
    existing.updatedAtVersion !== input.expectedVersion
  ) {
    return {
      ok: false,
      error:
        "This record changed after you opened it. Refresh and review the latest information before continuing.",
    };
  }
  const state = upsertOperationalState({
    recordType: input.recordType,
    recordId: input.recordId,
    lifecycle: "DELETED",
    organizationId: input.organizationId ?? DEFAULT_ORG_ID,
    previousLifecycle: existing?.lifecycle ?? "ACTIVE",
    deletedAt: new Date().toISOString(),
    deletedByUserId: input.actorUserId,
    deletedByName: input.actorName,
    deletionReason: input.reason,
    deletionNotes: input.notes ?? null,
    archivedAt: existing?.archivedAt ?? null,
    archivedByUserId: existing?.archivedByUserId ?? null,
    archiveReason: existing?.archiveReason ?? null,
    displayName: input.displayName ?? existing?.displayName,
    customerName: input.customerName ?? existing?.customerName,
    machineName: input.machineName ?? existing?.machineName,
    updatedAtVersion: existing?.updatedAtVersion,
  });
  return { ok: true, state };
}

export function restoreOperationalRecord(input: {
  recordType: AdminRecordType;
  recordId: string;
  actorUserId: string;
  actorName: string;
  reason?: string;
  expectedVersion?: number;
}):
  | { ok: true; state: AdminOperationalState }
  | { ok: false; error: string } {
  const existing = getOperationalState(input.recordType, input.recordId);
  if (!existing || existing.lifecycle === "ACTIVE") {
    return {
      ok: false,
      error: "This record is not archived or deleted.",
    };
  }
  if (
    input.expectedVersion != null &&
    existing.updatedAtVersion !== input.expectedVersion
  ) {
    return {
      ok: false,
      error:
        "This record changed after you opened it. Refresh and review the latest information before continuing.",
    };
  }
  const target: AdminRecordLifecycle =
    existing.lifecycle === "DELETED" && existing.previousLifecycle === "ARCHIVED"
      ? "ARCHIVED"
      : "ACTIVE";
  const state = upsertOperationalState({
    ...existing,
    lifecycle: target,
    deletedAt: target === "ACTIVE" || target === "ARCHIVED" ? null : existing.deletedAt,
    deletedByUserId: null,
    deletionReason: null,
    deletionNotes: null,
    archivedAt: target === "ARCHIVED" ? existing.archivedAt : null,
    archiveReason: target === "ARCHIVED" ? existing.archiveReason : null,
    previousLifecycle: existing.lifecycle,
    updatedAtVersion: existing.updatedAtVersion,
  });
  return { ok: true, state };
}

export function unarchiveOperationalRecord(input: {
  recordType: AdminRecordType;
  recordId: string;
  actorUserId: string;
  actorName: string;
  expectedVersion?: number;
}):
  | { ok: true; state: AdminOperationalState }
  | { ok: false; error: string } {
  const existing = getOperationalState(input.recordType, input.recordId);
  if (!existing || existing.lifecycle !== "ARCHIVED") {
    return { ok: false, error: "This record is not archived." };
  }
  if (
    input.expectedVersion != null &&
    existing.updatedAtVersion !== input.expectedVersion
  ) {
    return {
      ok: false,
      error:
        "This record changed after you opened it. Refresh and review the latest information before continuing.",
    };
  }
  const state = upsertOperationalState({
    ...existing,
    lifecycle: "ACTIVE",
    archivedAt: null,
    archivedByUserId: null,
    archiveReason: null,
    previousLifecycle: "ARCHIVED",
    updatedAtVersion: existing.updatedAtVersion,
  });
  return { ok: true, state };
}

export function invalidateOperationalRecord(input: {
  recordType: AdminRecordType;
  recordId: string;
  actorUserId: string;
  reason: string;
  organizationId?: string;
  displayName?: string;
}): AdminOperationalState {
  const existing = getOperationalState(input.recordType, input.recordId);
  return upsertOperationalState({
    recordType: input.recordType,
    recordId: input.recordId,
    lifecycle: existing?.lifecycle ?? "ACTIVE",
    organizationId: input.organizationId ?? DEFAULT_ORG_ID,
    isInvalid: true,
    invalidatedAt: new Date().toISOString(),
    invalidatedByUserId: input.actorUserId,
    invalidationReason: input.reason,
    displayName: input.displayName ?? existing?.displayName,
    updatedAtVersion: existing?.updatedAtVersion,
  });
}

export function isRecordDeleted(
  recordType: AdminRecordType,
  recordId: string,
): boolean {
  return getOperationalState(recordType, recordId)?.lifecycle === "DELETED";
}

export function isRecordArchived(
  recordType: AdminRecordType,
  recordId: string,
): boolean {
  return getOperationalState(recordType, recordId)?.lifecycle === "ARCHIVED";
}

export function isRecordInvalid(
  recordType: AdminRecordType,
  recordId: string,
): boolean {
  return Boolean(getOperationalState(recordType, recordId)?.isInvalid);
}

export function retentionStatus(deletedAt: string | null | undefined): {
  deletedDate: string | null;
  earliestPermanentDeleteDate: string | null;
  retentionDaysRemaining: number | null;
  status: "Protected" | "Eligible" | "Not deleted";
  protectionReason: string;
} {
  if (!deletedAt) {
    return {
      deletedDate: null,
      earliestPermanentDeleteDate: null,
      retentionDaysRemaining: null,
      status: "Not deleted",
      protectionReason: "Record is not soft deleted.",
    };
  }
  const deleted = new Date(deletedAt);
  const earliest = new Date(deleted);
  earliest.setDate(earliest.getDate() + DEFAULT_SOFT_DELETE_RETENTION_DAYS);
  const now = new Date();
  const remaining = Math.ceil(
    (earliest.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (remaining > 0) {
    return {
      deletedDate: deletedAt,
      earliestPermanentDeleteDate: earliest.toISOString(),
      retentionDaysRemaining: remaining,
      status: "Protected",
      protectionReason: `Soft-delete retention (${DEFAULT_SOFT_DELETE_RETENTION_DAYS} days) has not elapsed.`,
    };
  }
  return {
    deletedDate: deletedAt,
    earliestPermanentDeleteDate: earliest.toISOString(),
    retentionDaysRemaining: 0,
    status: "Eligible",
    protectionReason:
      "Retention period satisfied, but permanent deletion remains disabled by default and requires elevated permission.",
  };
}

/** Test helper — reset in-memory + session overlay. */
/** Patch 50C-3 — remove overlay row after eligible permanent delete (no history cascade). */
export function purgeOperationalRecord(
  recordType: AdminRecordType,
  recordId: string,
): { ok: true } | { ok: false; error: string } {
  const key = stateKey(recordType, recordId);
  const next = ensureStore().filter(
    (r) => stateKey(r.recordType, r.recordId) !== key,
  );
  if (next.length === ensureStore().length) {
    return { ok: false, error: "Operational overlay record not found." };
  }
  commit(next);
  return { ok: true };
}

export function __resetOperationalStateForTests(): void {
  memoryStore = [];
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
}
