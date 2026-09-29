import { NextResponse } from "next/server";
import { requireMatrixPermission } from "@/lib/auth/server";
import { compareBrowserWorkOrdersToServer } from "@/lib/work-orders/office-queue-compare-service";
import { getLatestOfficeDispatcherSignoff } from "@/lib/work-orders/office-dispatcher-signoff";
import { getConfiguredOfficePilotManager } from "@/lib/work-orders/office-pilot";
import { getLatestOfficePilotSignoff } from "@/lib/work-orders/office-pilot-signoff";
import { getOfficeRoleAllowlist } from "@/lib/work-orders/office-role-expansion";
import { getLatestOfficeRoleExpansionSignoff } from "@/lib/work-orders/office-role-expansion-signoff";
import {
  OFFICE_EXPANSION_HOLD_CONFIRMATION,
  OFFICE_EXPANSION_REVIEW_APPROVE_CONFIRMATION,
  OFFICE_EXPANSION_REVOKE_CONFIRMATION,
  buildExpansionReviewReadiness,
  type OfficeExpansionReviewDecision,
} from "@/lib/work-orders/office-rollout-expansion-review";
import { recordOfficeExpansionReviewDecision } from "@/lib/work-orders/office-rollout-expansion-review-signoff";
import { evaluateOfficeRolloutGuard } from "@/lib/work-orders/office-rollout-guard";
import { isServerOfficeWorkOrdersEnabled } from "@/lib/work-orders/server-office-read";
import type { WorkOrder } from "@/lib/work-orders/types";

/** Manager-only audited approve / hold / revoke for expansion beyond the role allowlist. */
export async function POST(request: Request) {
  const authResult = await requireMatrixPermission("MANAGE_WORK_ORDERS");
  if (!authResult.ok) return authResult.response;

  let body: {
    decision?: unknown;
    browserWorkOrders?: unknown;
    note?: unknown;
    confirmation?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const decision = body.decision;
  if (decision !== "approve" && decision !== "hold" && decision !== "revoke") {
    return NextResponse.json(
      { ok: false, error: "Provide decision approve, hold, or revoke." },
      { status: 400 },
    );
  }

  const expectedConfirmation =
    decision === "approve"
      ? OFFICE_EXPANSION_REVIEW_APPROVE_CONFIRMATION
      : decision === "hold"
        ? OFFICE_EXPANSION_HOLD_CONFIRMATION
        : OFFICE_EXPANSION_REVOKE_CONFIRMATION;

  if (body.confirmation !== expectedConfirmation) {
    return NextResponse.json(
      { ok: false, error: "Confirmation text does not match the requested decision." },
      { status: 400 },
    );
  }

  if (!Array.isArray(body.browserWorkOrders) || body.browserWorkOrders.length > 500) {
    return NextResponse.json(
      { ok: false, error: "Provide up to 500 browser work orders for expansion review." },
      { status: 400 },
    );
  }

  if (!isServerOfficeWorkOrdersEnabled()) {
    return NextResponse.json(
      { ok: false, error: "MATRIX_SERVER_OFFICE_WORK_ORDERS must be true before expansion review." },
      { status: 400 },
    );
  }

  const comparison = await compareBrowserWorkOrdersToServer(body.browserWorkOrders as WorkOrder[]);
  const guard = evaluateOfficeRolloutGuard(comparison);
  const pilotManager = getConfiguredOfficePilotManager();
  const pilotSignoff = pilotManager
    ? await getLatestOfficePilotSignoff(pilotManager)
    : { status: "none" as const };
  const dispatcherSignoff = await getLatestOfficeDispatcherSignoff();
  const roleExpansionSignoff = await getLatestOfficeRoleExpansionSignoff();
  const roleAllowlist = getOfficeRoleAllowlist();

  if (decision === "approve") {
    const readiness = buildExpansionReviewReadiness({
      guard,
      pilotSignoffStatus: pilotSignoff.status,
      dispatcherSignoffStatus: dispatcherSignoff.status,
      roleExpansionSignoffStatus: roleExpansionSignoff.status,
      roleAllowlistConfigured: roleAllowlist.length > 0,
    });
    if (!readiness.ready) {
      return NextResponse.json(
        { ok: false, error: readiness.blockers.join(" ") },
        { status: 409 },
      );
    }
    if (!comparison.readyForOfficeFlag) {
      return NextResponse.json(
        { ok: false, error: "Browser/server comparison must be clean before approving expansion review." },
        { status: 409 },
      );
    }
  }

  const note = typeof body.note === "string" ? body.note : undefined;
  const review = await recordOfficeExpansionReviewDecision({
    decision: decision as OfficeExpansionReviewDecision,
    actorId: authResult.userId,
    actorDisplayName: authResult.profile.displayName,
    actorEmail: authResult.profile.email,
    guardReady: guard.readyToEnableOfficeFlag,
    note,
    sourceRoute: "/api/work-orders/server-office-rollout/expansion-review/decision",
  });

  return NextResponse.json({
    ok: true,
    expansionReview: review,
    guard,
  });
}
