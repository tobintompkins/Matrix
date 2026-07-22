/**
 * Patch 50C-2 — Query / search / correlate over existing AuditLog.
 */

import { prisma } from "@/lib/db/prisma";
import { hasMatrixPermission } from "@/lib/auth/permissions";
import type { MatrixRole } from "@/lib/auth/types";
import { classifyAction } from "./taxonomy";
import { normalizeAuditRow, type AuditLogRow } from "./serializer";

export type SystemLogQuery = {
  organizationId: string;
  role: MatrixRole;
  category?: string;
  severity?: string;
  outcome?: string;
  eventType?: string;
  actorUserId?: string;
  targetType?: string;
  targetId?: string;
  sourceRoute?: string;
  httpMethod?: string;
  statusCode?: number;
  requestId?: string;
  correlationId?: string;
  q?: string;
  from?: string;
  to?: string;
  securityOnly?: boolean;
  page?: number;
  pageSize?: number;
};

function canViewCategory(role: MatrixRole, category: string) {
  switch (category) {
    case "SECURITY":
      return hasMatrixPermission(role, "VIEW_SECURITY_LOGS");
    case "AUTHENTICATION":
      return hasMatrixPermission(role, "VIEW_AUTHENTICATION_LOGS");
    case "AUTHORIZATION":
      return (
        hasMatrixPermission(role, "VIEW_PERMISSION_CHANGE_LOGS") ||
        hasMatrixPermission(role, "VIEW_SECURITY_LOGS")
      );
    case "DATA_CHANGE":
      return hasMatrixPermission(role, "VIEW_DATA_CHANGE_LOGS");
    case "API":
      return hasMatrixPermission(role, "VIEW_API_LOGS");
    case "ERROR":
    case "APPLICATION":
      return hasMatrixPermission(role, "VIEW_ERROR_LOGS");
    case "BACKGROUND_JOB":
      return hasMatrixPermission(role, "VIEW_JOB_LOGS");
    case "INTEGRATION":
    case "WEBHOOK":
      return hasMatrixPermission(role, "VIEW_INTEGRATION_LOGS");
    case "NOTIFICATION":
      return hasMatrixPermission(role, "VIEW_NOTIFICATION_LOGS");
    case "AUDIT":
    case "USER_ACTIVITY":
      return (
        hasMatrixPermission(role, "VIEW_AUDIT_LOGS") ||
        hasMatrixPermission(role, "VIEW_USER_ACTIVITY_LOGS") ||
        hasMatrixPermission(role, "VIEW_SYSTEM_LOGS")
      );
    default:
      return hasMatrixPermission(role, "VIEW_SYSTEM_LOGS");
  }
}

export async function querySystemLogEvents(input: SystemLogQuery) {
  if (!hasMatrixPermission(input.role, "VIEW_SYSTEM_LOGS")) {
    return { ok: false as const, error: "Forbidden", total: 0, items: [] };
  }

  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 25));
  const where: Record<string, unknown> = {
    organizationId: input.organizationId,
  };

  if (input.category) where.category = input.category;
  if (input.severity) where.severity = input.severity;
  if (input.outcome) where.outcome = input.outcome;
  if (input.eventType) where.action = input.eventType;
  if (input.actorUserId) where.actorId = input.actorUserId;
  if (input.targetType) where.entityType = input.targetType;
  if (input.targetId) where.entityId = input.targetId;
  if (input.sourceRoute) where.sourceRoute = { contains: input.sourceRoute };
  if (input.httpMethod) where.httpMethod = input.httpMethod;
  if (input.statusCode != null) where.statusCode = input.statusCode;
  if (input.requestId) where.requestId = input.requestId;
  if (input.correlationId) where.correlationId = input.correlationId;

  const createdAt: Record<string, Date> = {};
  if (input.from) createdAt.gte = new Date(input.from);
  if (input.to) createdAt.lte = new Date(input.to);
  if (Object.keys(createdAt).length) where.createdAt = createdAt;

  if (input.q?.trim()) {
    const q = input.q.trim().slice(0, 120);
    where.OR = [
      { action: { contains: q } },
      { message: { contains: q } },
      { entityId: { contains: q } },
      { entityType: { contains: q } },
      { requestId: { contains: q } },
      { correlationId: { contains: q } },
      { errorCode: { contains: q } },
      { sourceRoute: { contains: q } },
    ];
  }

  // Pull a larger window then filter by permission-aware category for legacy rows
  const [totalRaw, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize * 3,
    }),
  ]);

  const includeSensitive = hasMatrixPermission(
    input.role,
    "VIEW_SENSITIVE_LOG_METADATA",
  );

  const securityStates = await prisma.systemSecurityEventState.findMany({
    where: {
      organizationId: input.organizationId,
      auditLogId: { in: rows.map((r) => r.id) },
    },
  });
  const stateByAudit = new Map(securityStates.map((s) => [s.auditLogId, s.status]));

  const items = [];
  for (const row of rows) {
    const normalized = normalizeAuditRow(row as AuditLogRow, {
      includeSensitive,
      securityStatus: stateByAudit.get(row.id) ?? null,
    });
    if (input.securityOnly && normalized.category !== "SECURITY") {
      const inferred = classifyAction(row.action);
      if (!inferred.isSecurityCandidate && normalized.category !== "AUTHORIZATION") {
        continue;
      }
    }
    if (!canViewCategory(input.role, normalized.category)) continue;
    items.push(normalized);
    if (items.length >= pageSize) break;
  }

  return {
    ok: true as const,
    total: totalRaw,
    page,
    pageSize,
    items,
  };
}

export async function getSystemLogEvent(
  organizationId: string,
  role: MatrixRole,
  id: string,
) {
  const row = await prisma.auditLog.findFirst({
    where: { id, organizationId },
  });
  if (!row) return { ok: false as const, error: "Not found." };
  const normalized = normalizeAuditRow(row as AuditLogRow, {
    includeSensitive: hasMatrixPermission(role, "VIEW_SENSITIVE_LOG_METADATA"),
  });
  if (!canViewCategory(role, normalized.category)) {
    return { ok: false as const, error: "Not found." };
  }
  const security = await prisma.systemSecurityEventState.findUnique({
    where: { auditLogId: id },
  });
  return {
    ok: true as const,
    event: {
      ...normalized,
      securityStatus: security?.status ?? null,
      security: security
        ? {
            status: security.status,
            assignedUserId: security.assignedUserId,
            acknowledgedAt: security.acknowledgedAt?.toISOString() ?? null,
            investigatingAt: security.investigatingAt?.toISOString() ?? null,
            resolvedAt: security.resolvedAt?.toISOString() ?? null,
            resolutionNote: security.resolutionNote,
          }
        : null,
    },
  };
}

export async function getRelatedSystemLogEvents(input: {
  organizationId: string;
  role: MatrixRole;
  id: string;
}) {
  const detail = await getSystemLogEvent(
    input.organizationId,
    input.role,
    input.id,
  );
  if (!detail.ok) return detail;
  const correlationId = detail.event.correlationId;
  const requestId = detail.event.requestId;
  if (!correlationId && !requestId) {
    return {
      ok: true as const,
      event: detail.event,
      related: [] as ReturnType<typeof normalizeAuditRow>[],
      note: "No correlation or request ID is available for this event.",
    };
  }
  const or: Array<Record<string, string>> = [];
  if (correlationId) or.push({ correlationId });
  if (requestId) or.push({ requestId });
  const rows = await prisma.auditLog.findMany({
    where: {
      organizationId: input.organizationId,
      id: { not: input.id },
      OR: or,
    },
    orderBy: { createdAt: "asc" },
    take: 50,
  });
  const includeSensitive = hasMatrixPermission(
    input.role,
    "VIEW_SENSITIVE_LOG_METADATA",
  );
  const related = rows
    .map((r) =>
      normalizeAuditRow(r as AuditLogRow, { includeSensitive }),
    )
    .filter((e) => canViewCategory(input.role, e.category));
  return { ok: true as const, event: detail.event, related, note: null };
}
