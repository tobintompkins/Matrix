/**
 * Patch 51A.3 — Lightweight queue for event-driven re-evaluation.
 * Uses automation events as an outbox; cron/evaluate processes them.
 */

import { emitPredictiveEvent } from "./emit";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";

/** Queue a machine for predictive re-evaluation without blocking the caller. */
export async function queueMachineReEvaluation(input: {
  machineId: string;
  reason: string;
  organizationId?: string;
}) {
  if (!input.machineId.trim()) return;
  try {
    await emitPredictiveEvent({
      eventType: "predictive.reevaluate_requested",
      machineId: input.machineId,
      organizationId: input.organizationId ?? DEFAULT_ORG_ID,
      processInline: false,
      payload: {
        machineId: input.machineId,
        reason: input.reason,
        requestedAt: new Date().toISOString(),
      },
    });
  } catch {
    /* never block upstream mutations */
  }
}

/** Client-safe notify via HTTP (for browser mutation paths). */
export function notifyPredictiveReEvaluation(machineId: string, reason: string) {
  if (!machineId) return;
  void fetch("/api/ai-operations/automations/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventType: "predictive.reevaluate_requested",
      entityType: "Machine",
      entityId: machineId,
      payload: { machineId, reason, requestedAt: new Date().toISOString() },
    }),
  }).catch(() => {});
}
