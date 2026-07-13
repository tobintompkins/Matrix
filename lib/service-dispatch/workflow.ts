import type { DispatchTicketStatus } from "./types";

/**
 * Patch 41 status workflow. Includes legacy aliases (EN_ROUTE, DIAGNOSING, …)
 * so existing service-call records continue to transition correctly.
 */
const TRANSITIONS: Record<DispatchTicketStatus, DispatchTicketStatus[]> = {
  NEW: ["AWAITING_REVIEW", "UNASSIGNED", "ASSIGNED", "CANCELLED"],
  AWAITING_REVIEW: ["UNASSIGNED", "ASSIGNED", "CANCELLED"],
  UNASSIGNED: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["TECHNICIAN_NOTIFIED", "ACCEPTED", "UNASSIGNED", "CANCELLED"],
  TECHNICIAN_NOTIFIED: ["ACCEPTED", "UNASSIGNED", "CANCELLED"],
  ACCEPTED: ["SCHEDULED", "TRAVELING", "EN_ROUTE", "CANCELLED"],
  SCHEDULED: ["TRAVELING", "EN_ROUTE", "CANCELLED"],
  TRAVELING: ["ON_SITE", "CANCELLED"],
  EN_ROUTE: ["ON_SITE", "CANCELLED"],
  ON_SITE: ["DIAGNOSIS", "DIAGNOSING", "CANCELLED"],
  DIAGNOSIS: [
    "WAITING_FOR_PARTS",
    "REPAIR_IN_PROGRESS",
    "TESTING",
    "CUSTOMER_REVIEW",
    "ESCALATED",
    "RESOLVED",
    "CANCELLED",
  ],
  DIAGNOSING: [
    "WAITING_FOR_PARTS",
    "WAITING_FOR_CUSTOMER",
    "REPAIR_IN_PROGRESS",
    "TESTING",
    "ESCALATED",
    "RESOLVED",
    "CANCELLED",
  ],
  WAITING_FOR_PARTS: ["DIAGNOSIS", "DIAGNOSING", "REPAIR_IN_PROGRESS", "CANCELLED"],
  REPAIR_IN_PROGRESS: ["TESTING", "WAITING_FOR_PARTS", "RESOLVED", "CANCELLED"],
  TESTING: ["CUSTOMER_REVIEW", "REPAIR_IN_PROGRESS", "RESOLVED", "CANCELLED"],
  CUSTOMER_REVIEW: ["FOLLOW_UP_REQUIRED", "RESOLVED", "REPAIR_IN_PROGRESS", "CANCELLED"],
  WAITING_FOR_CUSTOMER: ["DIAGNOSING", "DIAGNOSIS", "CANCELLED"],
  FOLLOW_UP_REQUIRED: ["SCHEDULED", "RESOLVED", "CLOSED", "CANCELLED"],
  ESCALATED: ["DIAGNOSIS", "DIAGNOSING", "ASSIGNED", "CANCELLED"],
  RESOLVED: ["CLOSED", "REOPENED", "FOLLOW_UP_REQUIRED", "DIAGNOSIS", "DIAGNOSING"],
  CLOSED: ["REOPENED"],
  CANCELLED: ["REOPENED"],
  REOPENED: ["ASSIGNED", "UNASSIGNED", "DIAGNOSIS", "DIAGNOSING", "CANCELLED"],
};

export function getAllowedDispatchTransitions(
  status: DispatchTicketStatus,
): DispatchTicketStatus[] {
  return [...(TRANSITIONS[status] ?? [])];
}

export function canTransitionDispatch(
  from: DispatchTicketStatus,
  to: DispatchTicketStatus,
): boolean {
  if (from === to) return false;
  return getAllowedDispatchTransitions(from).includes(to);
}

export function assertDispatchTransition(
  from: DispatchTicketStatus,
  to: DispatchTicketStatus,
): { ok: true } | { ok: false; message: string } {
  // Hard rules from Patch 41
  if (from === "CLOSED" && to !== "REOPENED") {
    return { ok: false, message: "A closed ticket must be reopened before work resumes." };
  }
  if (from === "CANCELLED" && to !== "REOPENED") {
    return { ok: false, message: "A cancelled ticket must be reopened before work resumes." };
  }
  if (to === "ON_SITE" && !["TRAVELING", "EN_ROUTE", "ACCEPTED", "SCHEDULED"].includes(from)) {
    if (!canTransitionDispatch(from, to)) {
      return {
        ok: false,
        message: "Technician cannot mark On Site before accepting / traveling.",
      };
    }
  }
  if (!canTransitionDispatch(from, to)) {
    const allowed = getAllowedDispatchTransitions(from);
    return {
      ok: false,
      message:
        allowed.length === 0
          ? `Status ${from} is terminal.`
          : `Cannot move from ${from} to ${to}. Allowed: ${allowed.join(", ")}.`,
    };
  }
  return { ok: true };
}

export function normalizeLegacyStatus(status: string): DispatchTicketStatus {
  const map: Record<string, DispatchTicketStatus> = {
    EN_ROUTE: "TRAVELING",
    DIAGNOSING: "DIAGNOSIS",
    WAITING_FOR_CUSTOMER: "CUSTOMER_REVIEW",
    URGENT: "CRITICAL" as unknown as DispatchTicketStatus,
  };
  return (map[status] as DispatchTicketStatus) ?? (status as DispatchTicketStatus);
}

export function isActiveDispatchStatus(status: DispatchTicketStatus): boolean {
  return ![
    "RESOLVED",
    "CLOSED",
    "CANCELLED",
  ].includes(status);
}

export function isUnassignedStatus(status: DispatchTicketStatus): boolean {
  return ["NEW", "AWAITING_REVIEW", "UNASSIGNED"].includes(status);
}

export const DISPATCH_STATUS_ORDER: DispatchTicketStatus[] = [
  "NEW",
  "AWAITING_REVIEW",
  "UNASSIGNED",
  "ASSIGNED",
  "TECHNICIAN_NOTIFIED",
  "ACCEPTED",
  "SCHEDULED",
  "TRAVELING",
  "EN_ROUTE",
  "ON_SITE",
  "DIAGNOSIS",
  "DIAGNOSING",
  "WAITING_FOR_PARTS",
  "REPAIR_IN_PROGRESS",
  "TESTING",
  "CUSTOMER_REVIEW",
  "WAITING_FOR_CUSTOMER",
  "FOLLOW_UP_REQUIRED",
  "ESCALATED",
  "RESOLVED",
  "CLOSED",
  "CANCELLED",
  "REOPENED",
];

export const PRIORITY_DEFINITIONS = {
  LOW: {
    label: "Low",
    icon: "○",
    summary: "Minor issue — machine remains usable, no major production impact.",
  },
  NORMAL: {
    label: "Normal",
    icon: "◐",
    summary: "Standard request — reduced performance; workaround may be available.",
  },
  HIGH: {
    label: "High",
    icon: "◉",
    summary: "Significant production impact — limited operation; rapid response required.",
  },
  CRITICAL: {
    label: "Critical",
    icon: "⚠",
    summary: "Machine completely down — production stopped; emergency response required.",
  },
} as const;
