import { NextResponse } from "next/server";
import { requireMatrixPermission } from "@/lib/auth/server";
import { compareBrowserWorkOrdersToServer } from "@/lib/work-orders/office-queue-compare-service";
import { evaluateOfficeRolloutGuard } from "@/lib/work-orders/office-rollout-guard";
import { getOfficeDispatcherSignoffContext } from "@/lib/work-orders/office-dispatcher-signoff";
import { getOfficePilotSignoffContext } from "@/lib/work-orders/office-pilot-signoff";
import { getOfficeRoleExpansionSignoffContext } from "@/lib/work-orders/office-role-expansion-signoff";
import { buildOfficeRolloutStatusForUser } from "@/lib/work-orders/office-rollout-status";
import { isServerOfficeWorkOrdersEnabled } from "@/lib/work-orders/server-office-read";
import type { WorkOrder } from "@/lib/work-orders/types";

/** Manager-only office role expansion monitoring. */
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
      { ok: false, error: "Provide up to 500 browser work orders for role expansion monitoring." },
      { status: 400 },
    );
  }

  const comparison = await compareBrowserWorkOrdersToServer(body.browserWorkOrders as WorkOrder[]);
  const guard = evaluateOfficeRolloutGuard(comparison);
  const officeFlagEnabled = isServerOfficeWorkOrdersEnabled();
  const pilotContext = await getOfficePilotSignoffContext();
  const dispatcherContext = await getOfficeDispatcherSignoffContext();
  const roleContext = await getOfficeRoleExpansionSignoffContext();

  const rolloutStatus = buildOfficeRolloutStatusForUser({
    officeFlagEnabled,
    profile: authResult.profile,
    guard,
    pilotSignoff: pilotContext.signoff,
    dispatcherSignoff: dispatcherContext.signoff,
    roleExpansionSignoff: roleContext.signoff,
    dispatcherAllowlist: dispatcherContext.allowlist,
    roleAllowlist: roleContext.allowlist,
    isManager: true,
  });

  return NextResponse.json({
    ok: true,
    rolloutStatus,
    guard,
    roleExpansionSignoff: roleContext.signoff,
    roleAllowlist: roleContext.allowlist,
    roleExpansionSignoffAudits: roleContext.audits,
    pilotSignoffStatus: pilotContext.signoff.status,
    dispatcherSignoffStatus: dispatcherContext.signoff.status,
  });
}
