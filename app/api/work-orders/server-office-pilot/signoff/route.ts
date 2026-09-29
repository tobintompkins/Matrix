import { NextResponse } from "next/server";
import { requireMatrixPermission } from "@/lib/auth/server";
import { compareBrowserWorkOrdersToServer } from "@/lib/work-orders/office-queue-compare-service";
import { evaluateOfficeRolloutGuard } from "@/lib/work-orders/office-rollout-guard";
import {
  getConfiguredOfficePilotManager,
  matchesOfficePilotManager,
  type OfficePilotSignoffDecision,
} from "@/lib/work-orders/office-pilot";
import {
  getLatestOfficePilotSignoff,
  recordOfficePilotSignoffDecision,
} from "@/lib/work-orders/office-pilot-signoff";
import { isServerOfficeWorkOrdersEnabled } from "@/lib/work-orders/server-office-read";
import type { WorkOrder } from "@/lib/work-orders/types";

/** Manager-only pilot sign-off decisions (audited). */
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

  if (body.confirmation !== "OFFICE_PILOT_SIGNOFF") {
    return NextResponse.json(
      { ok: false, error: 'Confirmation must be "OFFICE_PILOT_SIGNOFF".' },
      { status: 400 },
    );
  }

  if (!Array.isArray(body.browserWorkOrders) || body.browserWorkOrders.length > 500) {
    return NextResponse.json(
      { ok: false, error: "Provide up to 500 browser work orders for pilot sign-off." },
      { status: 400 },
    );
  }

  const pilotManager = getConfiguredOfficePilotManager();
  if (!pilotManager) {
    return NextResponse.json(
      { ok: false, error: "Set MATRIX_SERVER_OFFICE_PILOT_MANAGER before recording pilot sign-off." },
      { status: 400 },
    );
  }

  if (!isServerOfficeWorkOrdersEnabled()) {
    return NextResponse.json(
      {
        ok: false,
        error: "MATRIX_SERVER_OFFICE_WORK_ORDERS must be true before pilot sign-off. Keep false until guard and rollback checks pass.",
      },
      { status: 400 },
    );
  }

  const comparison = await compareBrowserWorkOrdersToServer(body.browserWorkOrders as WorkOrder[]);
  const guard = evaluateOfficeRolloutGuard(comparison);

  if (decision === "approve") {
    if (!guard.readyToEnableOfficeFlag) {
      return NextResponse.json(
        { ok: false, error: "Rollout guard must be ready before approving the one-manager pilot." },
        { status: 409 },
      );
    }
    if (!matchesOfficePilotManager(authResult.profile, pilotManager)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Only the configured pilot manager can approve the one-manager office server queue pilot.",
        },
        { status: 403 },
      );
    }
  }

  const note = typeof body.note === "string" ? body.note : undefined;
  const signoff = await recordOfficePilotSignoffDecision({
    decision: decision as OfficePilotSignoffDecision,
    actorId: authResult.userId,
    actorDisplayName: authResult.profile.displayName,
    actorEmail: authResult.profile.email,
    pilotManager,
    guardReady: guard.readyToEnableOfficeFlag,
    note,
    sourceRoute: "/api/work-orders/server-office-pilot/signoff",
  });

  return NextResponse.json({
    ok: true,
    signoff,
    guard,
    pilotManager,
    latest: await getLatestOfficePilotSignoff(pilotManager),
  });
}
