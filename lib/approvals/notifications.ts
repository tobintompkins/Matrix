/**
 * Patch 50A — Approval notifications via existing Matrix notification system.
 * Email delivery is behind a no-op adapter until a provider is configured.
 */

import {
  createEventNotification,
  pushNotification,
} from "@/lib/notifications";
import type { NotificationPriority, NotificationType } from "@/lib/notifications/types";

function tryEmail(_input: {
  toUserIds: string[];
  subject: string;
  body: string;
}): void {
  // Adapter reserved — do not fail the patch when email is unset.
  if (!process.env.SMTP_HOST && !process.env.EMAIL_PROVIDER) return;
  // Future: route through Matrix email service.
}

export function notifyApprovalEvent(input: {
  type: NotificationType;
  title: string;
  message: string;
  userIds: string[];
  approvalRequestId: string;
  priority?: NotificationPriority;
  customerName?: string | null;
}) {
  const recipients = input.userIds.filter(Boolean);
  if (recipients.length === 0) return;

  pushNotification(
    createEventNotification({
      type: input.type,
      title: input.title,
      message: input.message,
      userIds: recipients,
      priority: input.priority ?? "NORMAL",
      relatedRecordType: "approval_request",
      relatedRecordId: input.approvalRequestId,
      customerName: input.customerName ?? null,
      printerId: null,
      printerName: null,
    }),
  );

  tryEmail({
    toUserIds: recipients,
    subject: input.title,
    body: input.message,
  });
}
