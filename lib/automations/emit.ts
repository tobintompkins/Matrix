/**
 * Patch 51A.2 — Emit automation events from existing Matrix modules.
 */

import { prisma } from "@/lib/db/prisma";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import { processAutomationEvent } from "./engine/execute-automation";

export async function emitAutomationEvent(input: {
  eventType: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
  organizationId?: string;
  processInline?: boolean;
}): Promise<{ eventId: string }> {
  const event = await prisma.aiOpsAutomationEvent.create({
    data: {
      organizationId: input.organizationId ?? DEFAULT_ORG_ID,
      eventType: input.eventType,
      entityType: input.entityType,
      entityId: input.entityId,
      payloadJson: JSON.stringify(input.payload ?? {}),
      status: "PENDING",
      availableAt: new Date(),
    },
  });

  if (input.processInline !== false) {
    // Fire-and-forget safe: errors are stored on the event
    try {
      await processAutomationEvent(event.id);
    } catch (e) {
      await prisma.aiOpsAutomationEvent.update({
        where: { id: event.id },
        data: {
          status: "FAILED",
          lastError: e instanceof Error ? e.message : "Processing failed",
        },
      });
    }
  }

  return { eventId: event.id };
}
