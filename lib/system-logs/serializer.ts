/**
 * Patch 50C-2 — Normalize + serialize AuditLog into System Log events.
 */

import { redactObject, redactPayloadJson } from "./redaction";
import { classifyAction, type SystemLogCategory } from "./taxonomy";

export type AuditLogRow = {
  id: string;
  organizationId: string | null;
  actorId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  payload: string | null;
  category: string | null;
  severity: string | null;
  outcome: string | null;
  visibility: string | null;
  environment: string | null;
  requestId: string | null;
  correlationId: string | null;
  sourceModule: string | null;
  sourceRoute: string | null;
  httpMethod: string | null;
  statusCode: number | null;
  message: string | null;
  errorCode: string | null;
  durationMs: number | null;
  createdAt: Date;
};

export type SerializedSystemLogEvent = {
  id: string;
  organizationId: string | null;
  category: string;
  eventType: string;
  severity: string;
  outcome: string;
  visibility: string;
  environment: string | null;
  actorUserId: string | null;
  targetType: string | null;
  targetId: string | null;
  sourceModule: string | null;
  sourceRoute: string | null;
  httpMethod: string | null;
  statusCode: number | null;
  requestId: string | null;
  correlationId: string | null;
  message: string | null;
  summary: string;
  errorCode: string | null;
  metadata: Record<string, unknown> | null;
  durationMs: number | null;
  occurredAt: string;
  securityStatus?: string | null;
};

export function normalizeAuditRow(
  row: AuditLogRow,
  opts?: { includeSensitive?: boolean; securityStatus?: string | null },
): SerializedSystemLogEvent {
  const inferred = classifyAction(row.action);
  const category = row.category ?? inferred.category;
  const severity = row.severity ?? inferred.severity;
  const outcome = row.outcome ?? inferred.outcome;
  const visibility = row.visibility ?? inferred.visibility;

  let metadata: Record<string, unknown> | null = null;
  if (row.payload) {
    try {
      const parsed = JSON.parse(row.payload) as Record<string, unknown>;
      metadata = opts?.includeSensitive
        ? redactObject(parsed)
        : redactObject(stripRestrictedMetadata(parsed));
    } catch {
      metadata = { note: "[unparseable payload redacted]" };
    }
  }

  return {
    id: row.id,
    organizationId: row.organizationId,
    category,
    eventType: row.action,
    severity,
    outcome,
    visibility,
    environment: row.environment,
    actorUserId: row.actorId,
    targetType: row.entityType,
    targetId: row.entityId,
    sourceModule: row.sourceModule,
    sourceRoute: row.sourceRoute,
    httpMethod: row.httpMethod,
    statusCode: row.statusCode,
    requestId: row.requestId,
    correlationId: row.correlationId,
    message: row.message,
    summary: row.message ?? humanizeAction(row.action),
    errorCode: row.errorCode,
    metadata,
    durationMs: row.durationMs,
    occurredAt: row.createdAt.toISOString(),
    securityStatus: opts?.securityStatus ?? null,
  };
}

function stripRestrictedMetadata(input: Record<string, unknown>) {
  const clone = { ...input };
  for (const key of Object.keys(clone)) {
    if (/ip|userAgent|user_agent|stack|trace|header/i.test(key)) {
      clone[key] = "[PERSONAL DATA HIDDEN]";
    }
  }
  return clone;
}

function humanizeAction(action: string) {
  return action
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}

export function parseSafePayload(raw: string | null) {
  return redactPayloadJson(raw);
}

export function categoryFilterValues(): SystemLogCategory[] {
  return [
    "AUDIT",
    "SECURITY",
    "AUTHENTICATION",
    "AUTHORIZATION",
    "USER_ACTIVITY",
    "DATA_CHANGE",
    "API",
    "APPLICATION",
    "ERROR",
    "BACKGROUND_JOB",
    "IMPORT",
    "EXPORT",
    "INTEGRATION",
    "NOTIFICATION",
    "APPROVAL",
    "CUSTOMER_PORTAL",
    "DATA_QUALITY",
    "CONFIGURATION",
    "SYSTEM",
  ];
}
