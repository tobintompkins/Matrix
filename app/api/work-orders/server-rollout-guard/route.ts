import { NextResponse } from "next/server";
import { requireMatrixPermission } from "@/lib/auth/server";
import { compareBrowserWorkOrdersToServer } from "@/lib/work-orders/office-queue-compare-service";
import { evaluateOfficeRolloutGuard } from "@/lib/work-orders/office-rollout-guard";
import { isServerOfficeWorkOrdersEnabled } from "@/lib/work-orders/server-office-read";
import type { WorkOrder } from "@/lib/work-orders/types";

/** Manager-only read-only guard before enabling MATRIX_SERVER_OFFICE_WORK_ORDERS. */
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
      { ok: false, error: "Provide up to 500 browser work orders to evaluate rollout." },
      { status: 400 },
    );
  }

  const comparison = await compareBrowserWorkOrdersToServer(body.browserWorkOrders as WorkOrder[]);
  const guard = evaluateOfficeRolloutGuard(comparison);

  return NextResponse.json({
    ok: true,
    officeFlagEnabled: isServerOfficeWorkOrdersEnabled(),
    guard,
    comparison,
  });
}
