/**
 * Centralized customer-facing status mapping (Patch 42 §27).
 * Internal statuses remain unchanged; only labels shown to customers change.
 */

const CUSTOMER_STATUS_LABELS: Record<string, string> = {
  NEW: "Request Received",
  AWAITING_REVIEW: "Under Review",
  UNASSIGNED: "Under Review",
  ASSIGNED: "Technician Assigned",
  TECHNICIAN_NOTIFIED: "Technician Assigned",
  ACCEPTED: "Technician Assigned",
  SCHEDULED: "Service Scheduled",
  TRAVELING: "Technician Traveling",
  EN_ROUTE: "Technician Traveling",
  ON_SITE: "Technician On Site",
  DIAGNOSIS: "Technician Working",
  DIAGNOSING: "Technician Working",
  REPAIR_IN_PROGRESS: "Repair in Progress",
  WAITING_FOR_PARTS: "Waiting for Parts",
  WAITING_FOR_CUSTOMER: "Customer Approval Needed",
  TESTING: "Final Testing",
  CUSTOMER_REVIEW: "Customer Approval Needed",
  FOLLOW_UP_REQUIRED: "Follow-Up Scheduled",
  ESCALATED: "Service Team Review",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  REOPENED: "Reopened",
  CANCELLED: "Cancelled",
};

let labelOverrides: Record<string, string> = {};

export function getCustomerStatusLabel(internalStatus: string): string {
  const key = internalStatus.toUpperCase();
  return labelOverrides[key] ?? CUSTOMER_STATUS_LABELS[key] ?? "In Progress";
}

export function setCustomerStatusLabelOverrides(
  overrides: Record<string, string>,
): void {
  labelOverrides = { ...overrides };
}

export function resetCustomerStatusLabelOverrides(): void {
  labelOverrides = {};
}

export function listCustomerStatusMappings(): Array<{
  internal: string;
  customer: string;
}> {
  return Object.keys(CUSTOMER_STATUS_LABELS).map((internal) => ({
    internal,
    customer: getCustomerStatusLabel(internal),
  }));
}

/** Timeline-safe activity labels for customer-visible events. */
export function getCustomerActivityLabel(updateType: string, newStatus: string): string {
  switch (updateType) {
    case "STATUS":
      return getCustomerStatusLabel(newStatus);
    case "MESSAGE":
      return "Customer comment added";
    case "PARTS":
      return "Waiting for Parts";
    case "ASSIGNMENT":
      return "Technician Assigned";
    case "SCHEDULE":
      return "Service Scheduled";
    default:
      return getCustomerStatusLabel(newStatus) || "Update";
  }
}
