/**
 * Patch 50C-1 — Notifications via existing Matrix notification system.
 */

import {
  createEventNotification,
  pushNotification,
} from "@/lib/notifications";
import type { NotificationPriority, NotificationType } from "@/lib/notifications/types";

export function notifyDataQualityEvent(input: {
  type: NotificationType;
  title: string;
  message: string;
  userIds: string[];
  issueId?: string | null;
  priority?: NotificationPriority;
}) {
  const recipients = input.userIds.filter(Boolean);
  if (!recipients.length) return;
  pushNotification(
    createEventNotification({
      type: input.type,
      title: input.title,
      message: input.message,
      userIds: recipients,
      priority: input.priority ?? "NORMAL",
      relatedRecordType: "data_quality_issue",
      relatedRecordId: input.issueId ?? null,
      customerName: null,
      printerId: null,
      printerName: null,
    }),
  );
}
