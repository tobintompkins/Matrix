import { NextResponse } from "next/server";
import { requireMatrixPermission } from "@/lib/auth/server";
import { canAccessFieldWorkOrder, hasConfiguredFieldApiIdentity } from "@/lib/field/api-authorization";
import { SESSION_ACTIONS_REQUIRING_REASON, type WorkSessionAction } from "@/lib/field/types";
import { getFieldWorkOrder } from "@/lib/work-orders/server-field-repository";

/** Work-session action validation endpoint (server authority). */
export async function POST(request: Request) {
  const authResult = await requireMatrixPermission("SYNC_FIELD_QUEUE");
  if (!authResult.ok) return authResult.response;
  if (!hasConfiguredFieldApiIdentity(authResult.profile)) {
    return NextResponse.json({ ok: false, error: "A configured Matrix role is required." }, { status: 403 });
  }
  let body: {
    workOrderId?: string;
    action?: WorkSessionAction;
    reason?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.workOrderId || !body.action) {
    return NextResponse.json(
      { ok: false, error: "workOrderId and action required" },
      { status: 400 },
    );
  }
  const workOrder = await getFieldWorkOrder(body.workOrderId);
  if (!workOrder) return NextResponse.json({ ok: false, error: "Work order not found" }, { status: 404 });
  if (!canAccessFieldWorkOrder(authResult.profile, workOrder)) {
    return NextResponse.json({ ok: false, error: "This work order is not assigned to the signed-in technician" }, { status: 403 });
  }

  if (
    SESSION_ACTIONS_REQUIRING_REASON.includes(body.action) &&
    !body.reason?.trim()
  ) {
    return NextResponse.json(
      { ok: false, error: "Reason required for this action" },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    accepted: true,
    workOrderId: body.workOrderId,
    action: body.action,
    occurredAt: new Date().toISOString(),
  });
}
