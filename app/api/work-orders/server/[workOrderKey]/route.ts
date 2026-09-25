import { NextResponse } from "next/server";
import { requireMatrixPermissionAny } from "@/lib/auth/server";
import {
  getServerWorkOrderDetailForOffice,
  isServerOfficeWorkOrdersEnabled,
} from "@/lib/work-orders/server-office-read";

type RouteContext = { params: Promise<{ workOrderKey: string }> };

/** Read-only durable work-order detail for office migration validation. */
export async function GET(_request: Request, context: RouteContext) {
  const authResult = await requireMatrixPermissionAny([
    "VIEW_WORK_ORDERS",
    "MANAGE_WORK_ORDERS",
  ]);
  if (!authResult.ok) return authResult.response;

  const { workOrderKey } = await context.params;
  const detail = await getServerWorkOrderDetailForOffice(decodeURIComponent(workOrderKey));
  if (!detail) {
    return NextResponse.json({ ok: false, error: "Work order not found." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    officeFlagEnabled: isServerOfficeWorkOrdersEnabled(),
    workOrder: detail.workOrder,
    timeline: detail.timeline,
    audit: detail.audit,
  });
}
