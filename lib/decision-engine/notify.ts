/**
 * Patch 51A.4 — Decision notifications via existing Matrix notify path.
 */

import {
  createEventNotification,
  pushNotification,
} from "@/lib/notifications";
import type { NotificationPriority } from "@/lib/notifications/types";

const recentKeys = new Set<string>();

export function notifyDecisionEvent(input: {
  title: string;
  message: string;
  decisionId: string;
  priority?: NotificationPriority;
}) {
  const key = `decision:${input.decisionId}:${input.title}`;
  if (recentKeys.has(key)) return;
  recentKeys.add(key);
  if (recentKeys.size > 200) {
    recentKeys.clear();
    recentKeys.add(key);
  }

  pushNotification(
    createEventNotification({
      type: "AI_CRITICAL_INSIGHT",
      title: input.title,
      message: input.message,
      priority: input.priority ?? "HIGH",
      relatedRecordType: "decision_recommendation",
      relatedRecordId: input.decisionId,
      customerName: null,
      printerId: null,
      printerName: null,
    }),
  );
}
