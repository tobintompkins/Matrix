import { NextResponse } from "next/server";
import { requireMatrixPermission } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";

/** Read-only status for comparing prototype work orders to durable records. */
export async function GET() {
  const authResult = await requireMatrixPermission("MANAGE_WORK_ORDERS");
  if (!authResult.ok) return authResult.response;

  const workOrders = await prisma.workOrder.findMany({
    select: { id: true, workOrderNumber: true, legacyWorkOrderId: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ ok: true, workOrders });
}
