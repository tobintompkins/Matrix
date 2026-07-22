/**
 * Patch 51A.3 — Outcome links (prediction → action groundwork).
 */

import { prisma } from "@/lib/db/prisma";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";

export type PredictiveOutcomeType =
  | "PM_COMPLETED"
  | "SERVICE_CALL_CREATED"
  | "EMERGENCY_REPAIR"
  | "REPEAT_ISSUE"
  | "DOWNTIME"
  | "RECOMMENDATION_ACCEPTED"
  | "RECOMMENDATION_DISMISSED"
  | "RECOMMENDATION_COMPLETED";

export async function recordPredictiveOutcome(input: {
  machineId: string;
  outcomeType: PredictiveOutcomeType;
  organizationId?: string;
  healthSnapshotId?: string | null;
  recommendationId?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  notes?: string | null;
}) {
  if (!input.machineId.trim()) return null;
  return prisma.predictiveOutcomeLink.create({
    data: {
      organizationId: input.organizationId ?? DEFAULT_ORG_ID,
      machineId: input.machineId,
      outcomeType: input.outcomeType,
      healthSnapshotId: input.healthSnapshotId ?? null,
      recommendationId: input.recommendationId ?? null,
      relatedEntityType: input.relatedEntityType ?? null,
      relatedEntityId: input.relatedEntityId ?? null,
      notes: input.notes ?? null,
    },
  });
}
