/**
 * Patch 49B — Service Call administrative operations.
 */

import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import {
  getServiceCall,
  listAllServiceCallsRaw,
  listServiceCalls,
  replaceServiceCall,
} from "@/lib/service-calls/repository";
import type {
  ServiceCall,
  ServiceCallPriority,
  ServiceCallStatus,
  ServiceCallType,
} from "@/lib/service-calls/types";
import { validateDeletionReason } from "./deletion-reasons";
import { getRelationshipImpact } from "./relationship-impact";
import {
  softDeleteOperationalRecord,
  archiveOperationalRecord,
  restoreOperationalRecord,
  unarchiveOperationalRecord,
  upsertOperationalState,
} from "./operational-state";
import type { DeletionReasonKey } from "./types";

const COMPLETED_STATUSES: ServiceCallStatus[] = [
  "CLOSED",
  "RESOLVED",
];

export function isCompletedServiceCall(call: ServiceCall): boolean {
  return COMPLETED_STATUSES.includes(call.status);
}

export type AdminServiceCallActor = {
  userId: string;
  displayName: string;
  organizationId?: string;
  canEditCompleted: boolean;
};

export function listAdminServiceCalls(input: {
  search?: string;
  status?: string;
  priority?: string;
  technician?: string;
  customer?: string;
  recordState?: "ACTIVE" | "ARCHIVED" | "DELETED" | "ALL";
  page?: number;
  pageSize?: number;
}): { items: ServiceCall[]; total: number; page: number; pageSize: number } {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 20));
  const recordState = input.recordState ?? "ACTIVE";

  let calls =
    recordState === "DELETED" || recordState === "ALL"
      ? listAllServiceCallsRaw()
      : listServiceCalls({
          includeDeleted: false,
          includeArchived: recordState !== "ACTIVE",
        });

  if (recordState === "DELETED") {
    calls = calls.filter(
      (c) => c.recordState === "DELETED" || Boolean(c.deletedAt),
    );
  } else if (recordState === "ARCHIVED") {
    calls = calls.filter(
      (c) => c.recordState === "ARCHIVED" || Boolean(c.archivedAt),
    );
  } else if (recordState === "ACTIVE") {
    calls = calls.filter(
      (c) =>
        (c.recordState ?? "ACTIVE") === "ACTIVE" &&
        !c.deletedAt &&
        !c.archivedAt,
    );
  }

  const q = input.search?.trim().toLowerCase() ?? "";
  if (q) {
    calls = calls.filter((c) =>
      [
        c.id,
        c.workOrderNumber,
        c.ticketNumber,
        c.machine.customerName,
        c.machine.serialNumber,
        c.machine.machineId,
        c.assignment.technician,
        c.problem.issueTitle,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }
  if (input.status && input.status !== "ALL") {
    calls = calls.filter((c) => c.status === input.status);
  }
  if (input.priority && input.priority !== "ALL") {
    calls = calls.filter((c) => c.priority === input.priority);
  }
  if (input.technician) {
    calls = calls.filter((c) =>
      c.assignment.technician
        .toLowerCase()
        .includes(input.technician!.toLowerCase()),
    );
  }
  if (input.customer) {
    calls = calls.filter((c) =>
      c.machine.customerName
        .toLowerCase()
        .includes(input.customer!.toLowerCase()),
    );
  }

  calls = [...calls].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const total = calls.length;
  const start = (page - 1) * pageSize;
  return {
    items: calls.slice(start, start + pageSize),
    total,
    page,
    pageSize,
  };
}

export type ServiceCallAdminPatch = {
  customerName?: string;
  machineId?: string;
  serialNumber?: string;
  printerModel?: string;
  siteName?: string;
  technician?: string;
  priority?: ServiceCallPriority;
  serviceType?: ServiceCallType;
  status?: ServiceCallStatus;
  issueTitle?: string;
  symptoms?: string;
  requestedServiceDate?: string;
  scheduledStart?: string;
  expectedVersion?: number;
};

export function updateServiceCallAsAdmin(
  serviceCallId: string,
  patch: ServiceCallAdminPatch,
  actor: AdminServiceCallActor,
  reason: string,
): { ok: true; call: ServiceCall } | { ok: false; error: string } {
  const call = getServiceCall(serviceCallId);
  if (!call) return { ok: false, error: "Service call not found." };
  if (call.recordState === "DELETED" || call.deletedAt) {
    return {
      ok: false,
      error: "Deleted service calls must be restored before editing.",
    };
  }
  if (
    patch.expectedVersion != null &&
    (call.updatedAtVersion ?? 1) !== patch.expectedVersion
  ) {
    return {
      ok: false,
      error:
        "This record changed after you opened it. Refresh and review the latest information before continuing.",
    };
  }
  if (isCompletedServiceCall(call) && !actor.canEditCompleted) {
    return {
      ok: false,
      error:
        "This completed service call is protected and requires elevated access.",
    };
  }
  if (isCompletedServiceCall(call) && reason.trim().length < 3) {
    return {
      ok: false,
      error: "A written reason is required to edit a completed service call.",
    };
  }
  if (!isCompletedServiceCall(call) && reason.trim().length < 3) {
    return { ok: false, error: "A reason for change is required." };
  }

  const timestamp = new Date().toISOString();
  const next: ServiceCall = {
    ...call,
    updatedAt: timestamp,
    updatedAtVersion: (call.updatedAtVersion ?? 1) + 1,
    priority: patch.priority ?? call.priority,
    serviceType: patch.serviceType ?? call.serviceType,
    status: patch.status ?? call.status,
    machine: {
      ...call.machine,
      customerName: patch.customerName ?? call.machine.customerName,
      machineId: patch.machineId ?? call.machine.machineId,
      serialNumber: patch.serialNumber ?? call.machine.serialNumber,
      printerModel: patch.printerModel ?? call.machine.printerModel,
      siteName: patch.siteName ?? call.machine.siteName,
    },
    problem: {
      ...call.problem,
      issueTitle: patch.issueTitle ?? call.problem.issueTitle,
      symptoms: patch.symptoms ?? call.problem.symptoms,
    },
    assignment: {
      ...call.assignment,
      technician: patch.technician ?? call.assignment.technician,
    },
    schedule: {
      ...call.schedule,
      requestedServiceDate:
        patch.requestedServiceDate ?? call.schedule.requestedServiceDate,
      scheduledStart: patch.scheduledStart ?? call.schedule.scheduledStart,
    },
    activity: [
      {
        id: `act-admin-${Date.now()}`,
        serviceCallId: call.id,
        activityType: "NOTE_ADDED",
        description: `Administrative correction: ${reason.trim()}`,
        user: actor.displayName,
        timestamp,
        metadata: { adminCorrection: true, reason: reason.trim() },
      },
      ...call.activity,
    ],
  };

  const saved = replaceServiceCall(next);
  if (!saved) return { ok: false, error: "Unable to save service call." };
  return { ok: true, call: saved };
}

export function archiveServiceCall(
  serviceCallId: string,
  actor: AdminServiceCallActor,
  reason: string,
): { ok: true; call: ServiceCall } | { ok: false; error: string } {
  if (reason.trim().length < 3) {
    return { ok: false, error: "An archive reason is required." };
  }
  const call = getServiceCall(serviceCallId);
  if (!call) return { ok: false, error: "Service call not found." };
  if (call.recordState === "DELETED" || call.deletedAt) {
    return { ok: false, error: "Deleted records cannot be archived." };
  }
  const overlay = archiveOperationalRecord({
    recordType: "SERVICE_CALL",
    recordId: call.id,
    actorUserId: actor.userId,
    actorName: actor.displayName,
    reason: reason.trim(),
    organizationId: actor.organizationId,
    displayName: call.workOrderNumber,
    customerName: call.machine.customerName,
    machineName: call.machine.serialNumber,
  });
  if (!overlay.ok) return overlay;

  const next: ServiceCall = {
    ...call,
    recordState: "ARCHIVED",
    archivedAt: overlay.state.archivedAt,
    archivedByUserId: actor.userId,
    archiveReason: reason.trim(),
    updatedAt: new Date().toISOString(),
    updatedAtVersion: (call.updatedAtVersion ?? 1) + 1,
    activity: [
      {
        id: `act-archive-${Date.now()}`,
        serviceCallId: call.id,
        activityType: "NOTE_ADDED",
        description: `Service call archived: ${reason.trim()}`,
        user: actor.displayName,
        timestamp: new Date().toISOString(),
      },
      ...call.activity,
    ],
  };
  const saved = replaceServiceCall(next);
  if (!saved) return { ok: false, error: "Unable to archive service call." };
  return { ok: true, call: saved };
}

export function softDeleteServiceCall(
  serviceCallId: string,
  actor: AdminServiceCallActor,
  input: {
    reason: DeletionReasonKey | string;
    notes?: string | null;
    confirmPhrase: string;
  },
): { ok: true; call: ServiceCall } | { ok: false; error: string } {
  const call = getServiceCall(serviceCallId);
  if (!call) return { ok: false, error: "Service call not found." };
  if (call.recordState === "DELETED" || call.deletedAt) {
    return { ok: false, error: "This service call is already deleted." };
  }
  const reasonCheck = validateDeletionReason(input.reason, input.notes);
  if (!reasonCheck.ok) return reasonCheck;

  const expected = `DELETE ${call.workOrderNumber}`;
  if (input.confirmPhrase.trim() !== expected) {
    return {
      ok: false,
      error: `Type ${expected} to confirm deletion.`,
    };
  }

  const impact = getRelationshipImpact("SERVICE_CALL", call.id);
  // Soft delete is allowed; permanent delete is separate.
  void impact;

  const overlay = softDeleteOperationalRecord({
    recordType: "SERVICE_CALL",
    recordId: call.id,
    actorUserId: actor.userId,
    actorName: actor.displayName,
    reason: input.reason,
    notes: input.notes,
    organizationId: actor.organizationId,
    displayName: call.workOrderNumber,
    customerName: call.machine.customerName,
    machineName: call.machine.serialNumber,
  });
  if (!overlay.ok) return overlay;

  const next: ServiceCall = {
    ...call,
    recordState: "DELETED",
    deletedAt: overlay.state.deletedAt,
    deletedByUserId: actor.userId,
    deletionReason: String(input.reason),
    deletionNotes: input.notes ?? null,
    updatedAt: new Date().toISOString(),
    updatedAtVersion: (call.updatedAtVersion ?? 1) + 1,
    activity: [
      {
        id: `act-delete-${Date.now()}`,
        serviceCallId: call.id,
        activityType: "NOTE_ADDED",
        description: `Service call soft deleted: ${input.reason}`,
        user: actor.displayName,
        timestamp: new Date().toISOString(),
      },
      ...call.activity,
    ],
  };
  const saved = replaceServiceCall(next);
  if (!saved) return { ok: false, error: "Unable to delete service call." };
  return { ok: true, call: saved };
}

export function restoreServiceCall(
  serviceCallId: string,
  actor: AdminServiceCallActor,
  reason?: string,
): { ok: true; call: ServiceCall } | { ok: false; error: string } {
  const call =
    getServiceCall(serviceCallId) ??
    listAllServiceCallsRaw().find(
      (c) =>
        c.id === serviceCallId ||
        c.workOrderNumber.toUpperCase() === serviceCallId.toUpperCase(),
    );
  if (!call) return { ok: false, error: "Service call not found." };
  if (call.recordState !== "DELETED" && call.recordState !== "ARCHIVED" && !call.deletedAt && !call.archivedAt) {
    return { ok: false, error: "This service call is not archived or deleted." };
  }

  if (!call.machine.machineId && !call.machine.serialNumber) {
    return {
      ok: false,
      error:
        "This service call cannot be restored because the original machine reference is missing.",
    };
  }
  if (!call.machine.customerName) {
    return {
      ok: false,
      error:
        "This service call cannot be restored because the original customer no longer exists.",
    };
  }

  const wasDeleted = call.recordState === "DELETED" || Boolean(call.deletedAt);
  if (wasDeleted) {
    const overlay = restoreOperationalRecord({
      recordType: "SERVICE_CALL",
      recordId: call.id,
      actorUserId: actor.userId,
      actorName: actor.displayName,
      reason,
    });
    if (!overlay.ok) return overlay;
  } else {
    const overlay = unarchiveOperationalRecord({
      recordType: "SERVICE_CALL",
      recordId: call.id,
      actorUserId: actor.userId,
      actorName: actor.displayName,
    });
    if (!overlay.ok) return overlay;
  }

  const next: ServiceCall = {
    ...call,
    recordState: "ACTIVE",
    deletedAt: null,
    deletedByUserId: null,
    deletionReason: null,
    deletionNotes: null,
    archivedAt: null,
    archivedByUserId: null,
    archiveReason: null,
    updatedAt: new Date().toISOString(),
    updatedAtVersion: (call.updatedAtVersion ?? 1) + 1,
    activity: [
      {
        id: `act-restore-${Date.now()}`,
        serviceCallId: call.id,
        activityType: "NOTE_ADDED",
        description: `Service call restored${reason ? `: ${reason}` : ""}`,
        user: actor.displayName,
        timestamp: new Date().toISOString(),
      },
      ...call.activity,
    ],
  };
  const saved = replaceServiceCall(next);
  if (!saved) return { ok: false, error: "Unable to restore service call." };
  upsertOperationalState({
    recordType: "SERVICE_CALL",
    recordId: call.id,
    lifecycle: "ACTIVE",
    organizationId: actor.organizationId ?? DEFAULT_ORG_ID,
    displayName: call.workOrderNumber,
    updatedAtVersion: 0,
  });
  return { ok: true, call: saved };
}

export function permanentlyDeleteServiceCall(): {
  ok: false;
  error: string;
} {
  return {
    ok: false,
    error:
      "Permanent deletion of service calls is disabled by default. Soft-deleted records are retained to preserve inventory, diagnostic, and audit integrity.",
  };
}
