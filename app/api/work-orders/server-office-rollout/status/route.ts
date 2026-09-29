import { NextResponse } from "next/server";
import { requireMatrixPermissionAny } from "@/lib/auth/server";
import { hasMatrixPermission } from "@/lib/auth/permissions";
import { compareBrowserWorkOrdersToServer } from "@/lib/work-orders/office-queue-compare-service";
import { evaluateOfficeRolloutGuard } from "@/lib/work-orders/office-rollout-guard";
import { getOfficeDispatcherSignoffContext } from "@/lib/work-orders/office-dispatcher-signoff";
import { getOfficePilotSignoffContext } from "@/lib/work-orders/office-pilot-signoff";
import { getOfficeRoleExpansionSignoffContext } from "@/lib/work-orders/office-role-expansion-signoff";
import { getLatestOfficeExpansionReview } from "@/lib/work-orders/office-rollout-expansion-review-signoff";
import { buildOfficeRolloutStatusForUser } from "@/lib/work-orders/office-rollout-status";
import { isServerOfficeWorkOrdersEnabled } from "@/lib/work-orders/server-office-read";
import type { WorkOrder } from "@/lib/work-orders/types";

/** Effective office queue rollout status (pilot + dispatcher + role expansion) for the current user. */
export async function POST(request: Request) {
  const authResult = await requireMatrixPermissionAny([
    "VIEW_WORK_ORDERS",
    "MANAGE_WORK_ORDERS",
  ]);
  if (!authResult.ok) return authResult.response;

  let body: { browserWorkOrders?: unknown };
  try {
    body = (await request.json()) as { browserWorkOrders?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.browserWorkOrders) || body.browserWorkOrders.length > 500) {
    return NextResponse.json(
      { ok: false, error: "Provide up to 500 browser work orders for rollout status." },
      { status: 400 },
    );
  }

  const comparison = await compareBrowserWorkOrdersToServer(body.browserWorkOrders as WorkOrder[]);
  const guard = evaluateOfficeRolloutGuard(comparison);
  const officeFlagEnabled = isServerOfficeWorkOrdersEnabled();
  const pilotContext = await getOfficePilotSignoffContext();
  const dispatcherContext = await getOfficeDispatcherSignoffContext();
  const roleContext = await getOfficeRoleExpansionSignoffContext();
  const expansionReview = await getLatestOfficeExpansionReview();
  const isManager = hasMatrixPermission(authResult.profile.role, "MANAGE_WORK_ORDERS");

  const rolloutStatus = buildOfficeRolloutStatusForUser({
    officeFlagEnabled,
    profile: authResult.profile,
    guard,
    pilotSignoff: pilotContext.signoff,
    dispatcherSignoff: dispatcherContext.signoff,
    roleExpansionSignoff: roleContext.signoff,
    expansionReview,
    dispatcherAllowlist: dispatcherContext.allowlist,
    roleAllowlist: roleContext.allowlist,
    isManager,
  });

  return NextResponse.json({
    ok: true,
    rolloutStatus,
    guard,
    pilotSignoff: pilotContext.signoff,
    dispatcherSignoff: dispatcherContext.signoff,
    roleExpansionSignoff: roleContext.signoff,
    dispatcherAllowlist: dispatcherContext.allowlist,
    roleAllowlist: roleContext.allowlist,
    dispatcherSignoffAudits: dispatcherContext.audits,
    roleExpansionSignoffAudits: roleContext.audits,
  });
}
