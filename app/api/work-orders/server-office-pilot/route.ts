import { NextResponse } from "next/server";
import { requireMatrixPermission } from "@/lib/auth/server";
import { compareBrowserWorkOrdersToServer } from "@/lib/work-orders/office-queue-compare-service";
import { evaluateOfficeRolloutGuard } from "@/lib/work-orders/office-rollout-guard";
import { getOfficePilotSignoffContext } from "@/lib/work-orders/office-pilot-signoff";
import { buildOfficePilotStatus } from "@/lib/work-orders/office-pilot-status";
import { isServerOfficeWorkOrdersEnabled } from "@/lib/work-orders/server-office-read";
import type { WorkOrder } from "@/lib/work-orders/types";

/** Manager-only read-only one-manager office server queue pilot status. */
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
      { ok: false, error: "Provide up to 500 browser work orders for pilot status." },
      { status: 400 },
    );
  }

  const comparison = await compareBrowserWorkOrdersToServer(body.browserWorkOrders as WorkOrder[]);
  const guard = evaluateOfficeRolloutGuard(comparison);
  const officeFlagEnabled = isServerOfficeWorkOrdersEnabled();
  const signoffContext = await getOfficePilotSignoffContext();

  const pilot = buildOfficePilotStatus({
    officeFlagEnabled,
    profile: authResult.profile,
    guard,
    pilotManager: signoffContext.pilotManager,
    signoff: signoffContext.signoff,
    signoffAudits: signoffContext.audits,
  });

  return NextResponse.json({
    ok: true,
    pilot,
    guard,
    comparison: {
      browserCount: comparison.browserCount,
      serverCount: comparison.serverCount,
      readyForOfficeFlag: comparison.readyForOfficeFlag,
      mismatchCount: comparison.mismatchCount,
    },
  });
}
