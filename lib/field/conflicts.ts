import type { ConflictResolution, SyncConflict } from "./types";
import { newEntityId } from "./store";
import { putConflict } from "./queue";

export type ConflictCheckInput = {
  operationId: string;
  entityType: string;
  entityId: string;
  field: string;
  offlineValue: string;
  offlineChangedAt: string;
  serverValue: string;
  serverChangedAt: string;
  serverChangedBy: string;
  downloadedRevision: string;
};

export function detectConflict(input: ConflictCheckInput): SyncConflict | null {
  // No conflict if server revision matches what was downloaded / offline matches server
  if (input.offlineValue === input.serverValue) return null;
  if (input.serverChangedAt <= input.downloadedRevision) return null;
  // Server changed after download and values differ
  if (input.serverChangedAt > input.downloadedRevision) {
    return {
      id: newEntityId("cnf"),
      operationId: input.operationId,
      entityType: input.entityType,
      entityId: input.entityId,
      field: input.field,
      offlineValue: input.offlineValue,
      serverValue: input.serverValue,
      offlineChangedAt: input.offlineChangedAt,
      serverChangedAt: input.serverChangedAt,
      serverChangedBy: input.serverChangedBy,
      recommended: recommendResolution(input),
      status: "OPEN",
      resolution: null,
      resolvedBy: null,
      resolvedAt: null,
    };
  }
  return null;
}

export function recommendResolution(input: ConflictCheckInput): ConflictResolution {
  if (input.field === "status" && input.serverValue === "CANCELLED") {
    return "KEEP_SERVER";
  }
  if (input.field === "status" && input.serverValue === "COMPLETED") {
    return "KEEP_SERVER";
  }
  if (input.field === "assignedTechnician" && input.serverValue !== input.offlineValue) {
    return "ASK_MANAGER";
  }
  if (input.field === "notes") return "MERGE_NOTES";
  if (input.field === "copyCount") return "SAVE_AS_HISTORY";
  if (input.field === "partsQuantity") return "ASK_MANAGER";
  return "ASK_MANAGER";
}

export function canResolveConflictDestructively(role: string): boolean {
  return (
    role === "SUPER_ADMIN" ||
    role === "ADMIN" ||
    role === "SERVICE_MANAGER"
  );
}

export function resolveConflictChoice(
  conflict: SyncConflict,
  resolution: ConflictResolution,
  resolvedBy: string,
  role: string,
): { ok: boolean; error?: string; conflict?: SyncConflict } {
  if (conflict.status === "RESOLVED") {
    return { ok: false, error: "Conflict already resolved." };
  }
  if (
    (resolution === "SUBMIT_OFFLINE" || resolution === "KEEP_SERVER") &&
    resolution === "SUBMIT_OFFLINE" &&
    !canResolveConflictDestructively(role) &&
    conflict.recommended === "KEEP_SERVER"
  ) {
    // Technicians can submit offline for non-destructive cases; block override of cancelled/completed
    if (conflict.serverValue === "CANCELLED" || conflict.serverValue === "COMPLETED") {
      return {
        ok: false,
        error: "Only managers can override a cancelled or completed server work order.",
      };
    }
  }

  const next: SyncConflict = {
    ...conflict,
    status: "RESOLVED",
    resolution,
    resolvedBy,
    resolvedAt: new Date().toISOString(),
  };
  return { ok: true, conflict: next };
}

export async function recordConflict(conflict: SyncConflict): Promise<void> {
  await putConflict(conflict as SyncConflict & { id: string });
}
