import { NextResponse } from "next/server";
import { requireMatrixPermission } from "@/lib/auth/server";
import { compareBrowserWorkOrdersToServer } from "@/lib/work-orders/office-queue-compare-service";
import { evaluateOfficeRolloutGuard } from "@/lib/work-orders/office-rollout-guard";
import {
  getOfficeDispatcherAllowlist,
  isOfficeDispatcherAllowlistConfigured,
  type OfficeDispatcherSignoffDecision,
} from "@/lib/work-orders/office-dispatcher-group";
import {
  getLatestOfficeDispatcherSignoff,
  recordOfficeDispatcherSignoffDecision,
} from "@/lib/work-orders/office-dispatcher-signoff";
import { getConfiguredOfficePilotManager } from "@/lib/work-orders/office-pilot";
import { getLatestOfficePilotSignoff } from "@/lib/work-orders/office-pilot-signoff";
import { isServerOfficeWorkOrdersEnabled } from "@/lib/work-orders/server-office-read";
import type { WorkOrder } from "@/lib/work-orders/types";

/** Manager-only audited dispatcher group sign-off. */
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
  if (decision !== "approve" && decision !== "deny" && decision !== "revoke") {
    return NextResponse.json({ ok: false, error: "Provide decision approve, deny, or revoke." }, { status: 400 });
  }

  if (body.confirmation !== "OFFICE_DISPATCHER_GROUP_SIGNOFF") {
    return NextResponse.json(
      { ok: false, error: 'Confirmation must be "OFFICE_DISPATCHER_GROUP_SIGNOFF".' },
      { status: 400 },
    );
  }

  if (!Array.isArray(body.browserWorkOrders) || body.browserWorkOrders.length > 500) {
    return NextResponse.json(
      { ok: false, error: "Provide up to 500 browser work orders for dispatcher sign-off." },
      { status: 400 },
    );
  }

  if (!isServerOfficeWorkOrdersEnabled()) {
    return NextResponse.json(
      { ok: false, error: "MATRIX_SERVER_OFFICE_WORK_ORDERS must be true before dispatcher group sign-off." },
      { status: 400 },
    );
  }

  const pilotManager = getConfiguredOfficePilotManager();
  if (!pilotManager) {
    return NextResponse.json(
      { ok: false, error: "Set MATRIX_SERVER_OFFICE_PILOT_MANAGER before dispatcher group sign-off." },
      { status: 400 },
    );
  }

  if (!isOfficeDispatcherAllowlistConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Set MATRIX_SERVER_OFFICE_DISPATCHER_ALLOWLIST before dispatcher group sign-off." },
      { status: 400 },
    );
  }

  const comparison = await compareBrowserWorkOrdersToServer(body.browserWorkOrders as WorkOrder[]);
  const guard = evaluateOfficeRolloutGuard(comparison);
  const pilotSignoff = await getLatestOfficePilotSignoff(pilotManager);
  const pilotSignoffApproved = pilotSignoff.status === "approved";

  if (decision === "approve") {
    if (!guard.readyToEnableOfficeFlag) {
      return NextResponse.json(
        { ok: false, error: "Rollout guard must be ready before approving the dispatcher group." },
        { status: 409 },
      );
    }
    if (!pilotSignoffApproved) {
      return NextResponse.json(
        { ok: false, error: "Named manager pilot sign-off must be approved before dispatcher group approval." },
        { status: 409 },
      );
    }
  }

  const note = typeof body.note === "string" ? body.note : undefined;
  const signoff = await recordOfficeDispatcherSignoffDecision({
    decision: decision as OfficeDispatcherSignoffDecision,
    actorId: authResult.userId,
    actorDisplayName: authResult.profile.displayName,
    actorEmail: authResult.profile.email,
    guardReady: guard.readyToEnableOfficeFlag,
    pilotSignoffApproved,
    note,
    sourceRoute: "/api/work-orders/server-office-dispatcher/signoff",
  });

  return NextResponse.json({
    ok: true,
    signoff,
    guard,
    allowlist: getOfficeDispatcherAllowlist(),
    latest: await getLatestOfficeDispatcherSignoff(),
  });
}
