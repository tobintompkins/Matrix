import { writeAdminAudit } from "@/lib/admin/repository";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";

export const FIELD_SYNC_PROCESS_AUDIT_ACTION = "FIELD_SYNC_RECEIPTS_PROCESSED";
export const FIELD_SYNC_PROCESS_AUDIT_ENTITY_TYPE = "FieldSyncProcessorRun";
export const FIELD_SYNC_PROCESS_AUDIT_ENTITY_ID = "field-sync-processor-v1";

export type FieldSyncProcessResult = {
  scanned?: number;
  applied?: number;
  waiting?: number;
};

export type FieldSyncProcessRun = {
  id: string;
  occurredAt: string;
  actorDisplayName: string | null;
  limit: number | null;
  totalScanned: number;
  totalApplied: number;
  totalWaiting: number;
  results: Record<string, FieldSyncProcessResult>;
};

function numberOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export function buildFieldSyncProcessAuditPayload(input: {
  limit: number;
  actorDisplayName: string;
  results: Record<string, FieldSyncProcessResult>;
}) {
  const values = Object.values(input.results);
  return {
    limit: input.limit,
    actorDisplayName: input.actorDisplayName,
    totalScanned: values.reduce((total, item) => total + numberOrZero(item.scanned), 0),
    totalApplied: values.reduce((total, item) => total + numberOrZero(item.applied), 0),
    totalWaiting: values.reduce((total, item) => total + numberOrZero(item.waiting), 0),
    results: input.results,
  };
}

export async function recordFieldSyncProcessRun(input: {
  actorId: string;
  actorDisplayName: string;
  limit: number;
  results: Record<string, FieldSyncProcessResult>;
}) {
  const payload = buildFieldSyncProcessAuditPayload(input);
  return writeAdminAudit({
    organizationId: DEFAULT_ORG_ID,
    actorId: input.actorId,
    action: FIELD_SYNC_PROCESS_AUDIT_ACTION,
    entityType: FIELD_SYNC_PROCESS_AUDIT_ENTITY_TYPE,
    entityId: FIELD_SYNC_PROCESS_AUDIT_ENTITY_ID,
    sourceModule: "field",
    sourceRoute: "/api/field/sync/process",
    httpMethod: "POST",
    outcome: "SUCCESS",
    category: "OPERATIONS",
    severity: "LOW",
    message: `Field receipt processor run by ${input.actorDisplayName}.`,
    payload,
  });
}

export function mapFieldSyncProcessRun(row: {
  id: string;
  createdAt: Date;
  payload: string | null;
}): FieldSyncProcessRun {
  let payload: Record<string, unknown> = {};
  try {
    payload = row.payload ? (JSON.parse(row.payload) as Record<string, unknown>) : {};
  } catch {
    payload = {};
  }
  const results = typeof payload.results === "object" && payload.results !== null
    ? payload.results as Record<string, FieldSyncProcessResult>
    : {};
  return {
    id: row.id,
    occurredAt: row.createdAt.toISOString(),
    actorDisplayName: typeof payload.actorDisplayName === "string" ? payload.actorDisplayName : null,
    limit: typeof payload.limit === "number" ? payload.limit : null,
    totalScanned: numberOrZero(payload.totalScanned),
    totalApplied: numberOrZero(payload.totalApplied),
    totalWaiting: numberOrZero(payload.totalWaiting),
    results,
  };
}
