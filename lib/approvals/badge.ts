/** Map approval statuses/priorities to MatrixStatusBadge variants. */

export type ApprovalBadgeVariant =
  | "active"
  | "warning"
  | "error"
  | "completed"
  | "waiting-parts"
  | "offline";

export function approvalBadgeVariant(value: string): ApprovalBadgeVariant {
  const v = value.toUpperCase();
  if (
    v === "APPROVED" ||
    v === "COMPLETED" ||
    v === "ACTIVE" ||
    v === "HEALTHY"
  ) {
    return "completed";
  }
  if (
    v === "REJECTED" ||
    v === "CANCELLED" ||
    v === "CRITICAL" ||
    v === "OVERDUE" ||
    v === "ERROR"
  ) {
    return "error";
  }
  if (
    v === "RETURNED" ||
    v === "RETURNED_FOR_REVISION" ||
    v === "ESCALATED" ||
    v === "HIGH" ||
    v === "WARNING" ||
    v === "AT RISK"
  ) {
    return "warning";
  }
  if (
    v === "DRAFT" ||
    v === "WAITING" ||
    v === "ARCHIVED" ||
    v === "INACTIVE"
  ) {
    return "offline";
  }
  if (v === "PENDING" || v === "IN_REVIEW" || v === "NORMAL" || v === "LOW") {
    return "waiting-parts";
  }
  return "active";
}
