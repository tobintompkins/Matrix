import type { ServiceCallStatus } from "./types";

const TRANSITIONS: Record<ServiceCallStatus, ServiceCallStatus[]> = {
  NEW: ["UNASSIGNED", "ASSIGNED", "CANCELLED"],
  UNASSIGNED: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["ACCEPTED", "UNASSIGNED", "CANCELLED"],
  ACCEPTED: ["EN_ROUTE", "CANCELLED"],
  EN_ROUTE: ["ON_SITE", "CANCELLED"],
  ON_SITE: ["DIAGNOSING", "CANCELLED"],
  DIAGNOSING: [
    "WAITING_FOR_PARTS",
    "WAITING_FOR_CUSTOMER",
    "ESCALATED",
    "RESOLVED",
    "CANCELLED",
  ],
  WAITING_FOR_PARTS: ["DIAGNOSING", "CANCELLED"],
  WAITING_FOR_CUSTOMER: ["DIAGNOSING", "CANCELLED"],
  ESCALATED: ["DIAGNOSING", "CANCELLED"],
  RESOLVED: ["CLOSED", "DIAGNOSING"],
  CLOSED: [],
  CANCELLED: [],
};

export function getAllowedServiceCallTransitions(
  status: ServiceCallStatus,
): ServiceCallStatus[] {
  return [...(TRANSITIONS[status] ?? [])];
}

export function canTransitionServiceCall(
  from: ServiceCallStatus,
  to: ServiceCallStatus,
): boolean {
  if (from === to) return false;
  return getAllowedServiceCallTransitions(from).includes(to);
}

export function assertServiceCallTransition(
  from: ServiceCallStatus,
  to: ServiceCallStatus,
): { ok: true } | { ok: false; message: string } {
  if (canTransitionServiceCall(from, to)) {
    return { ok: true };
  }
  const allowed = getAllowedServiceCallTransitions(from);
  return {
    ok: false,
    message:
      allowed.length === 0
        ? `Status ${from} is terminal — no further transitions are allowed.`
        : `Cannot move from ${from} to ${to}. Allowed: ${allowed.join(", ")}.`,
  };
}

export const SERVICE_CALL_STATUS_ORDER: ServiceCallStatus[] = [
  "NEW",
  "UNASSIGNED",
  "ASSIGNED",
  "ACCEPTED",
  "EN_ROUTE",
  "ON_SITE",
  "DIAGNOSING",
  "WAITING_FOR_PARTS",
  "WAITING_FOR_CUSTOMER",
  "ESCALATED",
  "RESOLVED",
  "CLOSED",
  "CANCELLED",
];

export const OPEN_SERVICE_CALL_STATUSES: ServiceCallStatus[] = [
  "NEW",
  "UNASSIGNED",
  "ASSIGNED",
  "ACCEPTED",
  "EN_ROUTE",
  "ON_SITE",
  "DIAGNOSING",
  "WAITING_FOR_PARTS",
  "WAITING_FOR_CUSTOMER",
  "ESCALATED",
];

export function isOpenServiceCallStatus(status: ServiceCallStatus): boolean {
  return OPEN_SERVICE_CALL_STATUSES.includes(status);
}
