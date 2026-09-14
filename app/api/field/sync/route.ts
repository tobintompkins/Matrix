import { NextResponse } from "next/server";
import { requireMatrixPermission } from "@/lib/auth/server";
import { canAccessFieldWorkOrder, hasConfiguredFieldApiIdentity } from "@/lib/field/api-authorization";
import type { OfflineOpType } from "@/lib/field/types";
import { getWorkOrder } from "@/lib/work-orders/repository";

const FIELD_OPERATION_TYPES = new Set<OfflineOpType>([
  "STATUS_CHANGE", "WORK_SESSION", "NOTE", "COPY_COUNT", "TIME_ENTRY", "PARTS_USAGE",
  "MAINTENANCE_COMPLETION", "PHOTO", "ATTACHMENT", "SIGNATURE", "COMPLETION",
]);

type SubmittedOperation = { operationId?: unknown; type?: unknown; userId?: unknown; workOrderId?: unknown };

/** Authorization boundary for the future durable sync service. */
export async function POST(request: Request) {
  const authResult = await requireMatrixPermission("SYNC_FIELD_QUEUE");
  if (!authResult.ok) return authResult.response;
  if (!hasConfiguredFieldApiIdentity(authResult.profile)) {
    return NextResponse.json({ ok: false, error: "A configured Matrix role is required for Field sync." }, { status: 403 });
  }

  let body: { operations?: unknown };
  try { body = await request.json(); } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  if (!Array.isArray(body.operations) || body.operations.length === 0 || body.operations.length > 50) {
    return NextResponse.json({ ok: false, error: "operations must contain 1 to 50 items" }, { status: 400 });
  }

  const results = body.operations.map((raw) => {
    const op = raw as SubmittedOperation;
    if (typeof op.operationId !== "string" || !op.operationId.trim() || typeof op.type !== "string" || !FIELD_OPERATION_TYPES.has(op.type as OfflineOpType)) {
      return { operationId: typeof op.operationId === "string" ? op.operationId : null, status: "REJECTED", error: "A valid operationId and type are required" };
    }
    if (op.userId !== authResult.userId) {
      return { operationId: op.operationId, status: "REJECTED", error: "Operation owner does not match the signed-in user" };
    }
    if (typeof op.workOrderId === "string" && op.workOrderId) {
      const workOrder = getWorkOrder(op.workOrderId);
      if (!workOrder) return { operationId: op.operationId, status: "REJECTED", error: "Work order not found" };
      if (!canAccessFieldWorkOrder(authResult.profile, workOrder)) {
        return { operationId: op.operationId, status: "REJECTED", error: "This work order is not assigned to the signed-in technician" };
      }
    }
    return { operationId: op.operationId, status: "AUTHORIZED" };
  });

  return NextResponse.json({ ok: results.every((result) => result.status === "AUTHORIZED"), results, receivedAt: new Date().toISOString(), persistence: "pending-server-repository" });
}
