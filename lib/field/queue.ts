import { getOfflineStore, newEntityId, newOperationId } from "./store";
import type {
  FieldAuditEntry,
  OfflineOpStatus,
  OfflineOpType,
  OfflineOperation,
  PendingAttachment,
  SyncConflict,
} from "./types";

function nowIso() {
  return new Date().toISOString();
}

export async function enqueueOperation(input: {
  type: OfflineOpType;
  userId: string;
  technicianName: string;
  workOrderId?: string | null;
  printerId?: string | null;
  payload: Record<string, unknown>;
  dependsOn?: string[];
  operationId?: string;
}): Promise<OfflineOperation> {
  const store = getOfflineStore();
  const operationId = input.operationId ?? newOperationId();

  // Idempotent: same operationId returns existing
  const existing = await store.get<OfflineOperation>("operations", operationId);
  if (existing) return existing;

  const op: OfflineOperation = {
    id: operationId,
    operationId,
    type: input.type,
    status: "PENDING",
    userId: input.userId,
    technicianName: input.technicianName,
    workOrderId: input.workOrderId ?? null,
    printerId: input.printerId ?? null,
    payload: input.payload,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    retryCount: 0,
    lastError: null,
    conflictStatus: null,
    dependsOn: input.dependsOn ?? [],
    synchronizedAt: null,
  };

  await store.put("operations", op);
  await appendFieldAudit({
    userId: input.userId,
    action: `QUEUE_${input.type}`,
    entityType: "OfflineOperation",
    entityId: operationId,
    operationId,
    previousValue: null,
    newValue: JSON.stringify(input.payload).slice(0, 500),
    syncStatus: "PENDING",
    error: null,
  });
  return op;
}

export async function listOperations(
  filter?: { status?: OfflineOpStatus | OfflineOpStatus[]; userId?: string },
): Promise<OfflineOperation[]> {
  const store = getOfflineStore();
  let ops = await store.getAll<OfflineOperation & { id: string }>("operations");
  if (filter?.userId) ops = ops.filter((o) => o.userId === filter.userId);
  if (filter?.status) {
    const set = new Set(
      Array.isArray(filter.status) ? filter.status : [filter.status],
    );
    ops = ops.filter((o) => set.has(o.status));
  }
  return ops.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getOperation(
  operationId: string,
): Promise<OfflineOperation | null> {
  return getOfflineStore().get("operations", operationId);
}

export async function updateOperationStatus(
  operationId: string,
  status: OfflineOpStatus,
  patch?: Partial<Pick<OfflineOperation, "lastError" | "conflictStatus" | "retryCount" | "synchronizedAt">>,
): Promise<OfflineOperation | null> {
  const store = getOfflineStore();
  const op = await store.get<OfflineOperation & { id: string }>("operations", operationId);
  if (!op) return null;
  const next = {
    ...op,
    status,
    updatedAt: nowIso(),
    ...patch,
  };
  await store.put("operations", next);
  return next;
}

export async function cancelOperation(
  operationId: string,
  confirm: boolean,
): Promise<{ ok: boolean; error?: string }> {
  if (!confirm) {
    return { ok: false, error: "Confirmation required to cancel unsynchronized action." };
  }
  const op = await getOperation(operationId);
  if (!op) return { ok: false, error: "Operation not found." };
  if (op.status === "SYNCHRONIZED") {
    return { ok: false, error: "Already synchronized — cannot cancel." };
  }
  await updateOperationStatus(operationId, "CANCELLED");
  return { ok: true };
}

export async function countPendingOps(userId?: string): Promise<number> {
  const ops = await listOperations({
    status: ["PENDING", "FAILED", "CONFLICT", "SYNCHRONIZING"],
    userId,
  });
  return ops.length;
}

export async function savePendingAttachment(
  attachment: Omit<PendingAttachment, "id" | "uploaded" | "createdAt"> & {
    id?: string;
  },
): Promise<PendingAttachment> {
  const store = getOfflineStore();
  const row: PendingAttachment & { id: string } = {
    id: attachment.id ?? newEntityId("att"),
    operationId: attachment.operationId,
    workOrderId: attachment.workOrderId,
    category: attachment.category,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    caption: attachment.caption,
    dataRef: attachment.dataRef,
    createdAt: nowIso(),
    uploaded: false,
  };
  await store.put("attachments", row);
  return row;
}

export async function listPendingAttachments(): Promise<PendingAttachment[]> {
  return getOfflineStore().getAll("attachments");
}

export async function appendFieldAudit(
  input: Omit<FieldAuditEntry, "id" | "occurredAt" | "deviceId"> & {
    deviceId?: string | null;
  },
): Promise<void> {
  const store = getOfflineStore();
  const entry: FieldAuditEntry & { id: string } = {
    id: newEntityId("faud"),
    userId: input.userId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    operationId: input.operationId,
    previousValue: input.previousValue,
    newValue: input.newValue,
    syncStatus: input.syncStatus,
    error: input.error,
    deviceId: input.deviceId ?? null,
    occurredAt: nowIso(),
  };
  await store.put("audit", entry);
}

export async function listFieldAudit(limit = 100): Promise<FieldAuditEntry[]> {
  const rows = await getOfflineStore().getAll<FieldAuditEntry>("audit");
  return rows.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, limit);
}

export async function listConflicts(): Promise<SyncConflict[]> {
  return getOfflineStore().getAll("conflicts");
}

export async function putConflict(conflict: SyncConflict & { id: string }): Promise<void> {
  await getOfflineStore().put("conflicts", conflict);
}
