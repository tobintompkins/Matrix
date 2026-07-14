/**
 * Patch 49B — Meter administration (invalidate / soft-delete overlay).
 */

import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import {
  getOperationalState,
  invalidateOperationalRecord,
  listOperationalStates,
  restoreOperationalRecord,
  softDeleteOperationalRecord,
} from "./operational-state";
import { validateDeletionReason } from "./deletion-reasons";
import type { DeletionReasonKey } from "./types";

const METER_CORRECTIONS_KEY = "matrix.admin.meter-corrections.v1";

export type AdminMeterCorrection = {
  meterId: string;
  machineId: string;
  previousReading: number;
  correctedReading: number;
  reason: string;
  correctedByUserId: string;
  correctedByName: string;
  correctedAt: string;
  previousReadingNeighbor?: number | null;
  nextReadingNeighbor?: number | null;
};

let corrections: AdminMeterCorrection[] | null = null;

function readCorrections(): AdminMeterCorrection[] {
  if (corrections) return corrections;
  if (typeof window !== "undefined") {
    try {
      const raw = window.sessionStorage.getItem(METER_CORRECTIONS_KEY);
      if (raw) {
        corrections = JSON.parse(raw) as AdminMeterCorrection[];
        return corrections;
      }
    } catch {
      /* ignore */
    }
  }
  corrections = [];
  return corrections;
}

function writeCorrections(next: AdminMeterCorrection[]) {
  corrections = next;
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(METER_CORRECTIONS_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export type AdminMeterActor = {
  userId: string;
  displayName: string;
  organizationId?: string;
};

export type AdminMeterRow = {
  meterId: string;
  machineId: string;
  reading: number;
  recordedAt: string;
  technician?: string;
  isInvalid: boolean;
  recordState: "ACTIVE" | "ARCHIVED" | "DELETED";
  correction?: AdminMeterCorrection | null;
};

/**
 * Build admin meter rows from correction overlay + operational state.
 * Source readings are supplied by the caller (PM/API) to avoid duplicating PM storage.
 */
export function listAdminMeterEntries(
  sourceRows: Array<{
    meterId: string;
    machineId: string;
    reading: number;
    recordedAt: string;
    technician?: string;
  }>,
  input: {
    search?: string;
    machineId?: string;
    recordState?: "ACTIVE" | "DELETED" | "INVALID" | "ALL";
    page?: number;
    pageSize?: number;
  } = {},
): { items: AdminMeterRow[]; total: number; page: number; pageSize: number } {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 20));
  const corrMap = new Map(readCorrections().map((c) => [c.meterId, c]));

  let rows: AdminMeterRow[] = sourceRows.map((s) => {
    const state = getOperationalState("METER", s.meterId);
    const corr = corrMap.get(s.meterId);
    return {
      meterId: s.meterId,
      machineId: s.machineId,
      reading: corr?.correctedReading ?? s.reading,
      recordedAt: s.recordedAt,
      technician: s.technician,
      isInvalid: Boolean(state?.isInvalid),
      recordState: state?.lifecycle ?? "ACTIVE",
      correction: corr ?? null,
    };
  });

  if (input.recordState === "DELETED") {
    rows = rows.filter((r) => r.recordState === "DELETED");
  } else if (input.recordState === "INVALID") {
    rows = rows.filter((r) => r.isInvalid && r.recordState !== "DELETED");
  } else if (input.recordState === "ACTIVE") {
    rows = rows.filter(
      (r) => r.recordState === "ACTIVE" && !r.isInvalid,
    );
  }

  if (input.machineId) {
    rows = rows.filter((r) => r.machineId === input.machineId);
  }
  const q = input.search?.trim().toLowerCase() ?? "";
  if (q) {
    rows = rows.filter((r) =>
      [r.meterId, r.machineId, String(r.reading), r.technician ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }

  rows = [...rows].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
  const total = rows.length;
  const start = (page - 1) * pageSize;
  return {
    items: rows.slice(start, start + pageSize),
    total,
    page,
    pageSize,
  };
}

export function correctMeterEntry(
  input: {
    meterId: string;
    machineId: string;
    currentReading: number;
    proposedReading: number;
    previousReading?: number | null;
    nextReading?: number | null;
    reason: string;
    expectedVersion?: number;
  },
  actor: AdminMeterActor,
): { ok: true; correction: AdminMeterCorrection } | { ok: false; error: string } {
  if (!Number.isFinite(input.proposedReading)) {
    return { ok: false, error: "Reading must be numeric." };
  }
  if (input.reason.trim().length < 3) {
    return { ok: false, error: "A reason is required for meter corrections." };
  }
  if (
    input.previousReading != null &&
    input.proposedReading < input.previousReading &&
    input.reason.trim().length < 3
  ) {
    return {
      ok: false,
      error: "Lower readings require a documented reason (possible rollover).",
    };
  }
  if (
    input.nextReading != null &&
    input.proposedReading > input.nextReading
  ) {
    return {
      ok: false,
      error:
        "The meter correction could not be saved because it would break sequence with a newer reading.",
    };
  }

  const state = getOperationalState("METER", input.meterId);
  if (state?.lifecycle === "DELETED") {
    return {
      ok: false,
      error: "Deleted meter entries must be restored before correction.",
    };
  }

  const correction: AdminMeterCorrection = {
    meterId: input.meterId,
    machineId: input.machineId,
    previousReading: input.currentReading,
    correctedReading: input.proposedReading,
    reason: input.reason.trim(),
    correctedByUserId: actor.userId,
    correctedByName: actor.displayName,
    correctedAt: new Date().toISOString(),
    previousReadingNeighbor: input.previousReading ?? null,
    nextReadingNeighbor: input.nextReading ?? null,
  };
  const next = [
    correction,
    ...readCorrections().filter((c) => c.meterId !== input.meterId),
  ];
  writeCorrections(next);
  return { ok: true, correction };
}

export function invalidateMeterEntry(
  meterId: string,
  machineId: string,
  actor: AdminMeterActor,
  reason: string,
): { ok: true } | { ok: false; error: string } {
  if (reason.trim().length < 3) {
    return { ok: false, error: "An invalidation reason is required." };
  }
  invalidateOperationalRecord({
    recordType: "METER",
    recordId: meterId,
    actorUserId: actor.userId,
    reason: reason.trim(),
    organizationId: actor.organizationId ?? DEFAULT_ORG_ID,
    displayName: `${machineId}:${meterId}`,
  });
  return { ok: true };
}

export function softDeleteMeterEntry(
  meterId: string,
  machineId: string,
  actor: AdminMeterActor,
  input: { reason: DeletionReasonKey | string; notes?: string | null },
): { ok: true } | { ok: false; error: string } {
  const reasonCheck = validateDeletionReason(input.reason, input.notes);
  if (!reasonCheck.ok) return reasonCheck;
  const overlay = softDeleteOperationalRecord({
    recordType: "METER",
    recordId: meterId,
    actorUserId: actor.userId,
    actorName: actor.displayName,
    reason: input.reason,
    notes: input.notes,
    organizationId: actor.organizationId ?? DEFAULT_ORG_ID,
    displayName: `${machineId} meter ${meterId}`,
    machineName: machineId,
  });
  if (!overlay.ok) return overlay;
  return { ok: true };
}

export function restoreMeterEntry(
  meterId: string,
  actor: AdminMeterActor,
  reason?: string,
): { ok: true } | { ok: false; error: string } {
  const overlay = restoreOperationalRecord({
    recordType: "METER",
    recordId: meterId,
    actorUserId: actor.userId,
    actorName: actor.displayName,
    reason,
  });
  if (!overlay.ok) return overlay;
  return { ok: true };
}

export function listDeletedMeterStates() {
  return listOperationalStates({ recordType: "METER", lifecycle: "DELETED" });
}

/** Whether a meter should drive PM calculations. */
export function isMeterValidForPm(meterId: string): boolean {
  const state = getOperationalState("METER", meterId);
  if (!state) return true;
  if (state.lifecycle === "DELETED") return false;
  if (state.isInvalid) return false;
  return true;
}
