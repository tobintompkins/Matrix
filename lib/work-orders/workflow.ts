import type { WorkOrderStatus } from "./types";

const TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  DRAFT: ["NEW", "CANCELLED"],
  NEW: ["ASSIGNED", "SCHEDULED", "CANCELLED"],
  ASSIGNED: ["SCHEDULED", "TRAVELING", "ON_HOLD", "CANCELLED"],
  SCHEDULED: ["TRAVELING", "ON_HOLD", "CANCELLED", "ASSIGNED"],
  TRAVELING: ["ON_SITE", "ON_HOLD", "CANCELLED"],
  ON_SITE: [
    "WAITING_FOR_PARTS",
    "WAITING_FOR_CUSTOMER",
    "ON_HOLD",
    "COMPLETED",
    "CANCELLED",
  ],
  WAITING_FOR_PARTS: ["ON_SITE", "ON_HOLD", "CANCELLED"],
  WAITING_FOR_CUSTOMER: ["ON_SITE", "ON_HOLD", "CANCELLED"],
  ON_HOLD: ["ASSIGNED", "SCHEDULED", "TRAVELING", "ON_SITE", "CANCELLED"],
  COMPLETED: ["CLOSED"],
  CANCELLED: [],
  CLOSED: [],
};

export function getAllowedWorkOrderTransitions(
  status: WorkOrderStatus,
): WorkOrderStatus[] {
  return [...(TRANSITIONS[status] ?? [])];
}

export function canTransitionWorkOrder(
  from: WorkOrderStatus,
  to: WorkOrderStatus,
): boolean {
  if (from === to) return false;
  return getAllowedWorkOrderTransitions(from).includes(to);
}

export function assertWorkOrderTransition(
  from: WorkOrderStatus,
  to: WorkOrderStatus,
): { ok: true } | { ok: false; message: string } {
  if (canTransitionWorkOrder(from, to)) return { ok: true };
  const allowed = getAllowedWorkOrderTransitions(from);
  return {
    ok: false,
    message:
      allowed.length === 0
        ? `Status ${from} is terminal.`
        : `Cannot move from ${from} to ${to}. Allowed: ${allowed.join(", ")}.`,
  };
}

export const WORK_ORDER_STATUS_ORDER: WorkOrderStatus[] = [
  "DRAFT",
  "NEW",
  "ASSIGNED",
  "SCHEDULED",
  "TRAVELING",
  "ON_SITE",
  "WAITING_FOR_PARTS",
  "WAITING_FOR_CUSTOMER",
  "ON_HOLD",
  "COMPLETED",
  "CANCELLED",
  "CLOSED",
];

export const OPEN_WORK_ORDER_STATUSES: WorkOrderStatus[] = [
  "DRAFT",
  "NEW",
  "ASSIGNED",
  "SCHEDULED",
  "TRAVELING",
  "ON_SITE",
  "WAITING_FOR_PARTS",
  "WAITING_FOR_CUSTOMER",
  "ON_HOLD",
];

export function isOpenWorkOrderStatus(status: WorkOrderStatus): boolean {
  return OPEN_WORK_ORDER_STATUSES.includes(status);
}

/** Quick-action target statuses for technicians */
export function quickActionTarget(
  action: "start" | "pause" | "resume" | "complete",
  current: WorkOrderStatus,
): WorkOrderStatus | null {
  switch (action) {
    case "start":
      if (["NEW", "ASSIGNED", "SCHEDULED"].includes(current)) return "TRAVELING";
      if (current === "TRAVELING") return "ON_SITE";
      return null;
    case "pause":
      if (["TRAVELING", "ON_SITE"].includes(current)) return "ON_HOLD";
      return null;
    case "resume":
      if (current === "ON_HOLD") return "ON_SITE";
      return null;
    case "complete":
      if (
        ["ON_SITE", "WAITING_FOR_PARTS", "WAITING_FOR_CUSTOMER"].includes(
          current,
        )
      ) {
        return "COMPLETED";
      }
      return null;
    default:
      return null;
  }
}
