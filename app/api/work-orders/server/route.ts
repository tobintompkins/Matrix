import { NextResponse } from "next/server";
import { requireMatrixPermission, requireMatrixPermissionAny } from "@/lib/auth/server";
import {
  isServerOfficeWorkOrdersEnabled,
  listServerWorkOrdersForOffice,
  SERVER_OFFICE_WORK_ORDER_LIST_LIMIT,
} from "@/lib/work-orders/server-office-read";
import { createServerWorkOrderForOffice } from "@/lib/work-orders/server-office-write";
import type { CreateWorkOrderInput } from "@/lib/work-orders/types";
import { officeActor, officeWriteJson } from "./_office-response";

/** Durable work-order list for office migration validation. */
export async function GET() {
  const authResult = await requireMatrixPermissionAny([
    "VIEW_WORK_ORDERS",
    "MANAGE_WORK_ORDERS",
  ]);
  if (!authResult.ok) return authResult.response;

  const workOrders = await listServerWorkOrdersForOffice();
  return NextResponse.json({
    ok: true,
    officeFlagEnabled: isServerOfficeWorkOrdersEnabled(),
    limit: SERVER_OFFICE_WORK_ORDER_LIST_LIMIT,
    workOrders,
  });
}

/** Create a durable server work order (office migration step 2). */
export async function POST(request: Request) {
  const authResult = await requireMatrixPermission("MANAGE_WORK_ORDERS");
  if (!authResult.ok) return authResult.response;

  let body: CreateWorkOrderInput;
  try {
    body = (await request.json()) as CreateWorkOrderInput;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const actor = officeActor(authResult.profile);
  const createdBy = body.createdBy?.trim() || actor;
  const result = await createServerWorkOrderForOffice({ ...body, createdBy }, actor);
  return officeWriteJson(result);
}
