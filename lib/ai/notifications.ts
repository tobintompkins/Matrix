/**
 * Patch 51A.1 Part 2 — AI Operations notifications via existing Matrix system.
 */

import {
  createEventNotification,
  pushNotification,
} from "@/lib/notifications";
import type { NotificationPriority, NotificationType } from "@/lib/notifications/types";

const recentKeys = new Set<string>();

function dedupeKey(type: string, relatedId: string | null | undefined) {
  return `${type}:${relatedId ?? "none"}`;
}

export function notifyAiOperationsEvent(input: {
  type: NotificationType;
  title: string;
  message: string;
  insightId?: string | null;
  userIds?: string[];
  priority?: NotificationPriority;
}) {
  const key = dedupeKey(input.type, input.insightId);
  if (recentKeys.has(key)) return;
  recentKeys.add(key);
  if (recentKeys.size > 200) {
    recentKeys.clear();
    recentKeys.add(key);
  }

  pushNotification(
    createEventNotification({
      type: input.type,
      title: input.title,
      message: input.message,
      userIds: input.userIds,
      priority: input.priority ?? "NORMAL",
      relatedRecordType: "ai_insight",
      relatedRecordId: input.insightId ?? null,
      customerName: null,
      printerId: null,
      printerName: null,
    }),
  );
}
