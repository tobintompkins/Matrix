/**
 * Patch 51A.3 — Emit predictive events into the AI Automation Framework.
 */

import { emitAutomationEvent } from "@/lib/automations/emit";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";

export async function emitPredictiveEvent(input: {
  eventType: string;
  machineId: string;
  payload: Record<string, unknown>;
  organizationId?: string;
  processInline?: boolean;
}) {
  return emitAutomationEvent({
    eventType: input.eventType,
    entityType: "Machine",
    entityId: input.machineId,
    payload: input.payload,
    organizationId: input.organizationId ?? DEFAULT_ORG_ID,
    processInline: input.processInline ?? false,
  });
}
