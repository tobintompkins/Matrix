import { NextResponse } from "next/server";
import {
  SESSION_ACTIONS_REQUIRING_REASON,
  type WorkSessionAction,
} from "@/lib/field/types";

/** Work-session action validation endpoint (server authority). */
export async function POST(request: Request) {
  let body: {
    workOrderId?: string;
    action?: WorkSessionAction;
    reason?: string;
    technicianId?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.workOrderId || !body.action || !body.technicianId) {
    return NextResponse.json(
      { ok: false, error: "workOrderId, action, and technicianId required" },
      { status: 400 },
    );
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
