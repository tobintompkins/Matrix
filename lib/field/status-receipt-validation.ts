import { assertWorkOrderTransition } from "@/lib/work-orders/workflow";
import type { WorkOrderStatus } from "@/lib/work-orders/types";

const FIELD_STATUSES = new Set<WorkOrderStatus>([
  "TRAVELING", "ON_SITE", "WAITING_FOR_PARTS",
  "WAITING_FOR_CUSTOMER", "COMPLETED",
]);

/** Validate a receipt before a later server processor may change a work order. */
export function validateFieldStatusReceipt(current: WorkOrderStatus, requested: unknown) {
  if (typeof requested !== "string" || !FIELD_STATUSES.has(requested as WorkOrderStatus)) {
    return { ok: false as const, error: "Unsupported Field work-order status." };
  }
  const transition = assertWorkOrderTransition(current, requested as WorkOrderStatus);
  if (!transition.ok) return { ok: false as const, error: transition.message };
  return { ok: true as const, status: requested as WorkOrderStatus };
}
