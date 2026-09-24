import { NextResponse } from "next/server";
import { requireMatrixPermission } from "@/lib/auth/server";
import { canAccessFieldWorkOrder, hasConfiguredFieldApiIdentity } from "@/lib/field/api-authorization";
import { listRecentFieldSyncReceipts, recordFieldSyncReceipt } from "@/lib/field/server-sync-receipts";
import type { AuthorizedFieldSyncOperation } from "@/lib/field/sync-receipt";
import type { OfflineOpType } from "@/lib/field/types";
import { getFieldWorkOrder } from "@/lib/work-orders/server-field-repository";

const FIELD_OPERATION_TYPES = new Set<OfflineOpType>([
  "STATUS_CHANGE", "WORK_SESSION", "NOTE", "COPY_COUNT", "TIME_ENTRY", "PARTS_USAGE",
  "MAINTENANCE_COMPLETION", "PHOTO", "ATTACHMENT", "SIGNATURE", "COMPLETION",
]);

/** Manager-only receipt inbox. Payloads are not exposed through this endpoint. */
export async function GET(request: Request) {
  const authResult = await requireMatrixPermission("VIEW_FIELD_ALL_TECHNICIANS");
  if (!authResult.ok) return authResult.response;
  if (!hasConfiguredFieldApiIdentity(authResult.profile)) {
    return NextResponse.json({ ok: false, error: "A configured Matrix role is required." }, { status: 403 });
  }
  const limitValue = Number(new URL(request.url).searchParams.get("limit") ?? "50");
  const receipts = await listRecentFieldSyncReceipts(Number.isFinite(limitValue) ? limitValue : 50);
  return NextResponse.json({ ok: true, receipts });
}

type SubmittedOperation = { operationId?: unknown; type?: unknown; userId?: unknown; workOrderId?: unknown; printerId?: unknown; payload?: unknown; dependsOn?: unknown };

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

  const results = await Promise.all(body.operations.map(async (raw) => {
    const op = raw as SubmittedOperation;
    if (typeof op.operationId !== "string" || !op.operationId.trim() || typeof op.type !== "string" || !FIELD_OPERATION_TYPES.has(op.type as OfflineOpType) || !op.payload || Array.isArray(op.payload) || typeof op.payload !== "object") {
      return { operationId: typeof op.operationId === "string" ? op.operationId : null, status: "REJECTED", error: "A valid operationId and type are required" };
    }
    if (op.userId !== authResult.userId) {
      return { operationId: op.operationId, status: "REJECTED", error: "Operation owner does not match the signed-in user" };
    }
    if (typeof op.workOrderId === "string" && op.workOrderId) {
      const workOrder = await getFieldWorkOrder(op.workOrderId);
      if (!workOrder) return { operationId: op.operationId, status: "REJECTED", error: "Work order not found" };
      if (!canAccessFieldWorkOrder(authResult.profile, workOrder)) {
        return { operationId: op.operationId, status: "REJECTED", error: "This work order is not assigned to the signed-in technician" };
      }
    }
    try {
      const receipt = await recordFieldSyncReceipt(authResult.profile, authResult.userId, {
        operationId: op.operationId,
        type: op.type,
        workOrderId: typeof op.workOrderId === "string" && op.workOrderId ? op.workOrderId : null,
        printerId: typeof op.printerId === "string" && op.printerId ? op.printerId : null,
        payload: op.payload as Record<string, unknown>,
        dependsOn: Array.isArray(op.dependsOn) && op.dependsOn.every((id) => typeof id === "string") ? op.dependsOn : [],
      } satisfies AuthorizedFieldSyncOperation);
      return { operationId: op.operationId, status: receipt.duplicate ? "DUPLICATE" : "RECEIVED", duplicate: receipt.duplicate };
    } catch {
      return { operationId: op.operationId, status: "RETRY", error: "The server could not store this sync receipt." };
    }
  }));

  return NextResponse.json({ ok: results.every((result) => result.status === "RECEIVED" || result.status === "DUPLICATE"), results, receivedAt: new Date().toISOString(), persistence: "server-receipt" });
}
