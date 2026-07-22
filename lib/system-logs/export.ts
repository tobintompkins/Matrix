/**
 * Patch 50C-2 — Safe CSV export of system log events.
 */

import type { AdminActor } from "@/lib/admin/auth";
import { writeAdminAudit } from "@/lib/admin/repository";
import { toCsv } from "@/lib/admin/completion/csv";
import { querySystemLogEvents } from "./query";

export async function exportSystemLogs(
  actor: AdminActor,
  kind: string,
  filters?: { category?: string; severity?: string; from?: string; to?: string },
) {
  const result = await querySystemLogEvents({
    organizationId: actor.organizationId,
    role: actor.role,
    category:
      kind === "security"
        ? "SECURITY"
        : kind === "authentication"
          ? "AUTHENTICATION"
          : kind === "errors"
            ? "ERROR"
            : kind === "api"
              ? "API"
              : filters?.category,
    severity: filters?.severity,
    from: filters?.from,
    to: filters?.to,
    page: 1,
    pageSize: 100,
  });
  if (!result.ok) return { ok: false as const, error: result.error };

  // Fetch up to export limit via multiple pages if needed
  const all = [...result.items];
  let page = 2;
  while (all.length < 2000 && all.length < result.total) {
    const next = await querySystemLogEvents({
      organizationId: actor.organizationId,
      role: actor.role,
      category: filters?.category ?? (kind === "events" ? undefined : result.items[0]?.category),
      severity: filters?.severity,
      from: filters?.from,
      to: filters?.to,
      page,
      pageSize: 100,
    });
    if (!next.ok || next.items.length === 0) break;
    all.push(...next.items);
    page += 1;
    if (page > 20) break;
  }

  const csv = toCsv(
    [
      "id",
      "occurredAt",
      "category",
      "severity",
      "eventType",
      "outcome",
      "actorUserId",
      "targetType",
      "targetId",
      "requestId",
      "correlationId",
      "sourceRoute",
      "statusCode",
      "summary",
    ],
    all.map((e) => [
      e.id,
      e.occurredAt,
      e.category,
      e.severity,
      e.eventType,
      e.outcome,
      e.actorUserId,
      e.targetType,
      e.targetId,
      e.requestId,
      e.correlationId,
      e.sourceRoute,
      e.statusCode,
      e.summary,
    ]),
  );

  await writeAdminAudit({
    organizationId: actor.organizationId,
    actorId: actor.userId,
    action: "SYSTEM_LOG_EXPORTED",
    entityType: "SystemLogExport",
    entityId: kind,
    category: "EXPORT",
    severity: "WARNING",
    outcome: "SUCCESS",
    payload: { kind, rowCount: all.length },
  });

  return {
    ok: true as const,
    filename: `system-logs-${kind}.csv`,
    csv,
  };
}
