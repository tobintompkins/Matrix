/**
 * Centralized customer-facing status mapping (Patch 42 §27 / 51B.1 IMPLEMENTATION_SPEC).
 * Internal statuses remain unchanged; only public codes + labels change.
 */

/** Spec §5 — public customer service status codes. */
export type CustomerServiceStatus =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "TECHNICIAN_ASSIGNED"
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "WAITING_FOR_PARTS"
  | "RESOLVED"
  | "CLOSED";

const CUSTOMER_STATUS_CODE: Record<string, CustomerServiceStatus> = {
  NEW: "SUBMITTED",
  AWAITING_REVIEW: "UNDER_REVIEW",
  UNASSIGNED: "UNDER_REVIEW",
  ASSIGNED: "TECHNICIAN_ASSIGNED",
  TECHNICIAN_NOTIFIED: "TECHNICIAN_ASSIGNED",
  ACCEPTED: "TECHNICIAN_ASSIGNED",
  SCHEDULED: "SCHEDULED",
  TRAVELING: "IN_PROGRESS",
  EN_ROUTE: "IN_PROGRESS",
  ON_SITE: "IN_PROGRESS",
  DIAGNOSIS: "IN_PROGRESS",
  DIAGNOSING: "IN_PROGRESS",
  REPAIR_IN_PROGRESS: "IN_PROGRESS",
  WAITING_FOR_PARTS: "WAITING_FOR_PARTS",
  WAITING_FOR_CUSTOMER: "UNDER_REVIEW",
  TESTING: "IN_PROGRESS",
  CUSTOMER_REVIEW: "UNDER_REVIEW",
  FOLLOW_UP_REQUIRED: "SCHEDULED",
  ESCALATED: "UNDER_REVIEW",
  RESOLVED: "RESOLVED",
  CLOSED: "CLOSED",
  REOPENED: "SUBMITTED",
  CANCELLED: "CLOSED",
};

const CUSTOMER_STATUS_LABELS: Record<CustomerServiceStatus, string> = {
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under Review",
  TECHNICIAN_ASSIGNED: "Technician Assigned",
  SCHEDULED: "Visit Scheduled",
  IN_PROGRESS: "In Progress",
  WAITING_FOR_PARTS: "Waiting for Parts",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

let labelOverrides: Record<string, string> = {};

export function mapInternalStatusToCustomer(
  internalStatus: string,
): CustomerServiceStatus {
  const key = internalStatus.toUpperCase();
  return CUSTOMER_STATUS_CODE[key] ?? "IN_PROGRESS";
}

export function getCustomerStatusLabel(internalStatus: string): string {
  const key = internalStatus.toUpperCase();
  if (labelOverrides[key]) return labelOverrides[key];
  const code = mapInternalStatusToCustomer(internalStatus);
  return CUSTOMER_STATUS_LABELS[code];
}

export function getCustomerStatusCodeLabel(code: CustomerServiceStatus): string {
  return CUSTOMER_STATUS_LABELS[code];
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
  customerCode: CustomerServiceStatus;
  customer: string;
}> {
  return Object.keys(CUSTOMER_STATUS_CODE).map((internal) => ({
    internal,
    customerCode: mapInternalStatusToCustomer(internal),
    customer: getCustomerStatusLabel(internal),
  }));
}

/** Timeline-safe activity labels for customer-visible events (spec §7). */
export function getCustomerActivityLabel(
  updateType: string,
  newStatus: string,
): string {
  switch (updateType) {
    case "STATUS":
      return getCustomerStatusLabel(newStatus);
    case "MESSAGE":
      return "Update from service team";
    case "PARTS":
      return getCustomerStatusCodeLabel("WAITING_FOR_PARTS");
    case "ASSIGNMENT":
      return getCustomerStatusCodeLabel("TECHNICIAN_ASSIGNED");
    case "SCHEDULE":
      return getCustomerStatusCodeLabel("SCHEDULED");
    default:
      return getCustomerStatusLabel(newStatus) || "Update";
  }
}

/**
 * Build a chronological customer-safe timeline from visible updates.
 */
export function buildCustomerVisibleTimeline(
  updates: Array<{
    id: string;
    updateType: string;
    newStatus: string;
    message: string;
    createdAt: string;
    createdBy?: string;
    visibleToCustomer?: boolean;
  }>,
): Array<{
  id: string;
  at: string;
  code: CustomerServiceStatus;
  label: string;
  message: string;
}> {
  return updates
    .filter((u) => u.visibleToCustomer !== false)
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((u) => ({
      id: u.id,
      at: u.createdAt,
      code: mapInternalStatusToCustomer(u.newStatus || "NEW"),
      label: getCustomerActivityLabel(u.updateType, u.newStatus),
      message: u.message,
    }));
}
