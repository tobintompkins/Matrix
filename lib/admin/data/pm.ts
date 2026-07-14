/**
 * Patch 49B — PM administrative helpers (soft-delete overlay + reopen prep).
 * Reuses existing PM Prisma repository; does not create a second PM system.
 */

import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import {
  archiveOperationalRecord,
  getOperationalState,
  restoreOperationalRecord,
  softDeleteOperationalRecord,
  unarchiveOperationalRecord,
} from "./operational-state";
import { validateDeletionReason } from "./deletion-reasons";
import type { DeletionReasonKey } from "./types";

export type AdminPmActor = {
  userId: string;
  displayName: string;
  organizationId?: string;
  canReopenCompleted: boolean;
};

export function isPmRecordDeleted(recordId: string): boolean {
  return getOperationalState("PM_HISTORY", recordId)?.lifecycle === "DELETED";
}

export function isPmScheduleDeleted(machineId: string): boolean {
  return getOperationalState("PM_SCHEDULE", machineId)?.lifecycle === "DELETED";
}

export function softDeletePmHistory(
  historyId: string,
  actor: AdminPmActor,
  input: {
    reason: DeletionReasonKey | string;
    notes?: string | null;
    machineId?: string;
  },
): { ok: true } | { ok: false; error: string } {
  const reasonCheck = validateDeletionReason(input.reason, input.notes);
  if (!reasonCheck.ok) return reasonCheck;
  const overlay = softDeleteOperationalRecord({
    recordType: "PM_HISTORY",
    recordId: historyId,
    actorUserId: actor.userId,
    actorName: actor.displayName,
    reason: input.reason,
    notes: input.notes,
    organizationId: actor.organizationId ?? DEFAULT_ORG_ID,
    displayName: `PM ${historyId}`,
    machineName: input.machineId,
  });
  if (!overlay.ok) return overlay;
  return { ok: true };
}

export function restorePmHistory(
  historyId: string,
  actor: AdminPmActor,
  reason?: string,
): { ok: true } | { ok: false; error: string } {
  const overlay = restoreOperationalRecord({
    recordType: "PM_HISTORY",
    recordId: historyId,
    actorUserId: actor.userId,
    actorName: actor.displayName,
    reason,
  });
  if (!overlay.ok) return overlay;
  return { ok: true };
}

export function archivePmSchedule(
  machineId: string,
  actor: AdminPmActor,
  reason: string,
): { ok: true } | { ok: false; error: string } {
  if (reason.trim().length < 3) {
    return { ok: false, error: "An archive reason is required." };
  }
  const overlay = archiveOperationalRecord({
    recordType: "PM_SCHEDULE",
    recordId: machineId,
    actorUserId: actor.userId,
    actorName: actor.displayName,
    reason: reason.trim(),
    organizationId: actor.organizationId ?? DEFAULT_ORG_ID,
    displayName: `PM schedule ${machineId}`,
    machineName: machineId,
  });
  if (!overlay.ok) return overlay;
  return { ok: true };
}

export function restorePmSchedule(
  machineId: string,
  actor: AdminPmActor,
): { ok: true } | { ok: false; error: string } {
  const state = getOperationalState("PM_SCHEDULE", machineId);
  if (!state || state.lifecycle === "ACTIVE") {
    return { ok: false, error: "This PM schedule is not archived or deleted." };
  }
  if (state.lifecycle === "DELETED") {
    const overlay = restoreOperationalRecord({
      recordType: "PM_SCHEDULE",
      recordId: machineId,
      actorUserId: actor.userId,
      actorName: actor.displayName,
    });
    if (!overlay.ok) return overlay;
  } else {
    const overlay = unarchiveOperationalRecord({
      recordType: "PM_SCHEDULE",
      recordId: machineId,
      actorUserId: actor.userId,
      actorName: actor.displayName,
    });
    if (!overlay.ok) return overlay;
  }
  return { ok: true };
}

/**
 * Reopen completed PM — validates permissions; actual reopen is performed via
 * existing PM APIs / history correction. Returns a structured admin audit payload.
 */
export function prepareReopenCompletedPm(
  historyId: string,
  actor: AdminPmActor,
  reason: string,
):
  | {
      ok: true;
      warning: string;
      auditEvent: string;
      historyId: string;
      reason: string;
    }
  | { ok: false; error: string } {
  if (!actor.canReopenCompleted) {
    return {
      ok: false,
      error:
        "This completed PM record is protected and requires elevated access.",
    };
  }
  if (reason.trim().length < 3) {
    return {
      ok: false,
      error: "A written reason is required to reopen a completed PM record.",
    };
  }
  if (isPmRecordDeleted(historyId)) {
    return {
      ok: false,
      error: "Deleted PM records must be restored before reopening.",
    };
  }
  return {
    ok: true,
    warning:
      "This PM record represents completed maintenance history. Changes may affect compliance reporting, next-due calculations, technician history, and machine maintenance records.",
    auditEvent: "PM_REOPENED",
    historyId,
    reason: reason.trim(),
  };
}

export const COMPLETED_PM_WARNING =
  "This PM record represents completed maintenance history. Changes may affect compliance reporting, next-due calculations, technician history, and machine maintenance records.";
