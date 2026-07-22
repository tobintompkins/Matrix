/**
 * Patch 51B.1 — Portal notification targeting helpers.
 * Recipients must match membership id/email (not displayName alone).
 */

import type { CustomerMembership } from "./types";

/** Stable recipient keys that portal inbox matching recognizes. */
export function portalRecipientIds(
  membership: Pick<
    CustomerMembership,
    "id" | "email" | "displayName" | "clerkUserId"
  >,
): string[] {
  return [
    ...new Set(
      [membership.id, membership.email, membership.displayName, membership.clerkUserId]
        .map((v) => (typeof v === "string" ? v.trim() : ""))
        .filter(Boolean),
    ),
  ];
}

export function notificationTargetsMembership(
  userIds: string[],
  membership: Pick<
    CustomerMembership,
    "id" | "email" | "displayName" | "clerkUserId"
  >,
): boolean {
  const allowed = new Set(portalRecipientIds(membership));
  return userIds.some((id) => allowed.has(id));
}

/** Types shown in the customer portal notification center. */
export function isPortalInboxNotificationType(type: string): boolean {
  return (
    type.startsWith("TICKET_") ||
    type.startsWith("PARTS_") ||
    type.startsWith("PM_") ||
    type === "CUSTOMER_RESPONSE" ||
    type === "TECHNICIAN_TRAVELING" ||
    type === "TECHNICIAN_ARRIVED" ||
    type === "SCHEDULE_CHANGED" ||
    type === "COPY_COUNT_UPDATED" ||
    type === "MAINTENANCE_COMPLETED"
  );
}
