import { NextResponse } from "next/server";
import { requireMatrixPermission } from "@/lib/auth/server";
import { copyWorkOrdersToServer } from "@/lib/work-orders/server-import";
import type { WorkOrder } from "@/lib/work-orders/types";

const COPY_CONFIRMATION = "COPY_WORK_ORDERS_TO_SERVER";

/** Explicit manager action. Existing server records are skipped, never replaced. */
export async function POST(request: Request) {
  const authResult = await requireMatrixPermission("MANAGE_WORK_ORDERS");
  if (!authResult.ok) return authResult.response;

  let body: { confirmation?: unknown; orders?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  if (body.confirmation !== COPY_CONFIRMATION) {
    return NextResponse.json({ ok: false, error: "Confirmation is required." }, { status: 400 });
  }
  if (!Array.isArray(body.orders) || body.orders.length === 0 || body.orders.length > 200) {
    return NextResponse.json({ ok: false, error: "Provide 1 to 200 work orders." }, { status: 400 });
  }

  const result = await copyWorkOrdersToServer(body.orders as WorkOrder[]);
  return NextResponse.json({ ok: true, result });
}
