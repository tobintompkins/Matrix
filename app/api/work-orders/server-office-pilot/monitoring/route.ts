import { NextResponse } from "next/server";
import { requireMatrixPermission } from "@/lib/auth/server";
import { compareBrowserWorkOrdersToServer } from "@/lib/work-orders/office-queue-compare-service";
import { evaluateOfficeRolloutGuard } from "@/lib/work-orders/office-rollout-guard";
import { buildOfficePilotMonitoringView } from "@/lib/work-orders/office-pilot-monitoring";
import { getOfficeDispatcherSignoffContext } from "@/lib/work-orders/office-dispatcher-signoff";
import { getOfficePilotSignoffContext } from "@/lib/work-orders/office-pilot-signoff";
import { buildOfficePilotStatus } from "@/lib/work-orders/office-pilot-status";
import { buildOfficeRolloutStatus } from "@/lib/work-orders/office-rollout-status";
import { isServerOfficeWorkOrdersEnabled } from "@/lib/work-orders/server-office-read";
import type { WorkOrder } from "@/lib/work-orders/types";

/** Manager-only read-only pilot monitoring for the one-manager office server queue. */
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
      { ok: false, error: "Provide up to 500 browser work orders for pilot monitoring." },
      { status: 400 },
    );
  }

  const comparison = await compareBrowserWorkOrdersToServer(body.browserWorkOrders as WorkOrder[]);
  const guard = evaluateOfficeRolloutGuard(comparison);
  const officeFlagEnabled = isServerOfficeWorkOrdersEnabled();
  const signoffContext = await getOfficePilotSignoffContext();
  const dispatcherContext = await getOfficeDispatcherSignoffContext();

  const pilot = buildOfficePilotStatus({
    officeFlagEnabled,
    profile: authResult.profile,
    guard,
    pilotManager: signoffContext.pilotManager,
    signoff: signoffContext.signoff,
    signoffAudits: signoffContext.audits,
  });

  const rolloutStatus = buildOfficeRolloutStatus({
    officeFlagEnabled,
    profile: authResult.profile,
    guard,
    pilotSignoff: signoffContext.signoff,
    dispatcherSignoff: dispatcherContext.signoff,
    dispatcherAllowlist: dispatcherContext.allowlist,
  });
  const rollout = rolloutStatus.effectiveRollout;

  const monitoring = buildOfficePilotMonitoringView({ pilot, guard, rollout });

  return NextResponse.json({
    ok: true,
    monitoring,
    guard,
    pilot: {
      pilotServerQueueEnabled: pilot.pilotServerQueueEnabled,
      signoffAudits: pilot.signoffAudits,
    },
  });
}
