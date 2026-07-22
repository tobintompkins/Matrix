import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import type { MatrixPermission } from "@/lib/auth/types";
import { querySystemLogEvents } from "@/lib/system-logs/query";

export function parseLogFilters(url: URL) {
  const sp = url.searchParams;
  const statusCodeRaw = sp.get("statusCode");
  return {
    category: sp.get("category") ?? undefined,
    severity: sp.get("severity") ?? undefined,
    outcome: sp.get("outcome") ?? undefined,
    eventType: sp.get("eventType") ?? undefined,
    actorUserId: sp.get("actorUserId") ?? undefined,
    targetType: sp.get("targetType") ?? undefined,
    targetId: sp.get("targetId") ?? undefined,
    sourceRoute: sp.get("sourceRoute") ?? undefined,
    httpMethod: sp.get("httpMethod") ?? undefined,
    statusCode: statusCodeRaw ? Number(statusCodeRaw) : undefined,
    requestId: sp.get("requestId") ?? undefined,
    correlationId: sp.get("correlationId") ?? undefined,
    q: sp.get("q") ?? undefined,
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
    page: Number(sp.get("page") ?? "1"),
    pageSize: Number(sp.get("pageSize") ?? "25"),
  };
}

export async function listCategoryLogs(
  req: Request,
  permission: MatrixPermission,
  defaults?: { category?: string; securityOnly?: boolean },
) {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, permission);
  if (denied) return denied;
  const filters = parseLogFilters(new URL(req.url));
  const result = await querySystemLogEvents({
    organizationId: actor.organizationId,
    role: actor.role,
    ...filters,
    category: filters.category ?? defaults?.category,
    securityOnly: defaults?.securityOnly,
  });
  if (!result.ok) {
    return NextResponse.json(result, { status: 403 });
  }
  return NextResponse.json(result);
}
