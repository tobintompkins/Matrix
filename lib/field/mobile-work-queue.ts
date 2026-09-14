import type { WorkOrder } from "../work-orders/types";

type QueueOrder = Pick<WorkOrder, "id" | "assignedTechnician" | "secondaryTechnician" | "status" | "priority" | "scheduledStart">;
const closed = new Set(["DRAFT", "COMPLETED", "CANCELLED", "CLOSED"]);
const waiting = new Set(["WAITING_FOR_PARTS", "WAITING_FOR_CUSTOMER", "ON_HOLD"]);
const active = new Set(["TRAVELING", "ON_SITE"]);
const priorities = { CRITICAL: 0, HIGH: 1, NORMAL: 2, LOW: 3 };

function scheduled(order: QueueOrder): number {
  const value = order.scheduledStart ? Date.parse(order.scheduledStart) : NaN;
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

/** Sorting is presentation only; never assigns, starts, or reschedules a job. */
export function prioritizeMobileWork<T extends QueueOrder>(orders: readonly T[], now = new Date()): T[] {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const rank = (order: T) => closed.has(order.status) ? 5
    : waiting.has(order.status) ? 4
    : active.has(order.status) ? 0
    : order.priority === "CRITICAL" ? 1
    : scheduled(order) < start ? 2 : 3;
  return [...orders].sort((a, b) =>
    rank(a) - rank(b) ||
    scheduled(a) - scheduled(b) ||
    priorities[a.priority] - priorities[b.priority] ||
    a.id.localeCompare(b.id),
  );
}

/** A blank identity must never turn "my next job" into everybody's queue. */
export function nextMobileWork<T extends QueueOrder>(orders: readonly T[], technician: string, now = new Date()): T | undefined {
  if (!technician.trim()) return undefined;
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
  return prioritizeMobileWork(orders.filter(order =>
    (order.assignedTechnician === technician || order.secondaryTechnician === technician) &&
    !closed.has(order.status) && !waiting.has(order.status) &&
    (active.has(order.status) || !order.scheduledStart || scheduled(order) < tomorrow)
  ), now)[0];
}
