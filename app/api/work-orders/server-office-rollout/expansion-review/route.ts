import { NextResponse } from "next/server";
import { requireMatrixPermission } from "@/lib/auth/server";
import { compareBrowserWorkOrdersToServer } from "@/lib/work-orders/office-queue-compare-service";
import { getOfficeDispatcherAllowlist } from "@/lib/work-orders/office-dispatcher-group";
import { getOfficeDispatcherSignoffContext } from "@/lib/work-orders/office-dispatcher-signoff";
import { getConfiguredOfficePilotManager } from "@/lib/work-orders/office-pilot";
import { getOfficePilotSignoffContext } from "@/lib/work-orders/office-pilot-signoff";
import { getOfficeRoleAllowlist } from "@/lib/work-orders/office-role-expansion";
import { getOfficeRoleExpansionSignoffContext } from "@/lib/work-orders/office-role-expansion-signoff";
import { buildOfficeRolloutExpansionReviewSummary } from "@/lib/work-orders/office-rollout-expansion-review";
import {
  getLatestOfficeExpansionReview,
  getOfficeExpansionReviewSignoffContext,
  listOfficeExpansionReviewAudits,
} from "@/lib/work-orders/office-rollout-expansion-review-signoff";
import { buildOfficeRolloutStatusForUser } from "@/lib/work-orders/office-rollout-status";
import { evaluateOfficeRolloutGuard } from "@/lib/work-orders/office-rollout-guard";
import { isServerOfficeWorkOrdersEnabled } from "@/lib/work-orders/server-office-read";
import type { WorkOrder } from "@/lib/work-orders/types";

/** Manager-only office rollout expansion review summary (Steps 1–11 gates + comparison health). */
export async function POST(request: Request) {
  const authResult = await requireMatrixPermission("MANAGE_WORK_ORDERS");
  if (!authResult.ok) return authResult.response;

  let body: { browserWorkOrders?: unknown };
  try {
    body = (await request.json()) as { browserWorkOrders?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.browserWorkOrders) || body.browserWorkOrders.length > 500) {
    return NextResponse.json(
      { ok: false, error: "Provide up to 500 browser work orders for expansion review." },
      { status: 400 },
    );
  }

  const comparison = await compareBrowserWorkOrdersToServer(body.browserWorkOrders as WorkOrder[]);
  const guard = evaluateOfficeRolloutGuard(comparison);
  const officeFlagEnabled = isServerOfficeWorkOrdersEnabled();
  const pilotManager = getConfiguredOfficePilotManager();
  const pilotContext = await getOfficePilotSignoffContext();
  const dispatcherContext = await getOfficeDispatcherSignoffContext();
  const roleContext = await getOfficeRoleExpansionSignoffContext();
  const expansionContext = await getOfficeExpansionReviewSignoffContext();
  const roleAllowlist = getOfficeRoleAllowlist();

  const summary = buildOfficeRolloutExpansionReviewSummary({
    officeFlagEnabled,
    guard,
    comparison,
    pilotManager,
    pilotSignoffStatus: pilotContext.signoff.status,
    dispatcherAllowlistCount: getOfficeDispatcherAllowlist().length,
    dispatcherSignoffStatus: dispatcherContext.signoff.status,
    roleAllowlist,
    roleExpansionSignoffStatus: roleContext.signoff.status,
    expansionReviewStatus: expansionContext.review.status,
    recentAudits: expansionContext.audits.slice(0, 8).map((entry) => ({
      id: entry.id,
      action: entry.action,
      occurredAt: entry.occurredAt,
      actorId: entry.actorId,
      message: entry.message,
    })),
  });

  const rolloutStatus = buildOfficeRolloutStatusForUser({
    officeFlagEnabled,
    profile: authResult.profile,
    guard,
    pilotSignoff: pilotContext.signoff,
    dispatcherSignoff: dispatcherContext.signoff,
    roleExpansionSignoff: roleContext.signoff,
    expansionReview: expansionContext.review,
    dispatcherAllowlist: dispatcherContext.allowlist,
    roleAllowlist: roleContext.allowlist,
    isManager: true,
  });

  return NextResponse.json({
    ok: true,
    summary,
    rolloutStatus,
    recentRolloutAudits: expansionContext.recentRolloutAudits,
    expansionReview: await getLatestOfficeExpansionReview(),
    expansionReviewAudits: await listOfficeExpansionReviewAudits(12),
  });
}
