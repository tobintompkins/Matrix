/**
 * Patch 51A.4 — Settings + history helpers.
 */

import { prisma } from "@/lib/db/prisma";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import {
  DECISION_RULES_VERSION,
  DEFAULT_DECISION_WEIGHTS,
  type DecisionEngineWeights,
} from "./types";

export async function getOrCreateDecisionSettings(
  organizationId = DEFAULT_ORG_ID,
) {
  const existing = await prisma.decisionEngineSetting.findUnique({
    where: { organizationId },
  });
  if (existing) return existing;
  return prisma.decisionEngineSetting.create({
    data: {
      organizationId,
      rulesVersion: DECISION_RULES_VERSION,
      riskWeight: DEFAULT_DECISION_WEIGHTS.riskWeight,
      urgencyWeight: DEFAULT_DECISION_WEIGHTS.urgencyWeight,
      businessImpactWeight: DEFAULT_DECISION_WEIGHTS.businessImpactWeight,
      slaWeight: DEFAULT_DECISION_WEIGHTS.slaWeight,
      confidenceWeight: DEFAULT_DECISION_WEIGHTS.confidenceWeight,
    },
  });
}

export function weightsFromSettings(
  row: Awaited<ReturnType<typeof getOrCreateDecisionSettings>>,
): DecisionEngineWeights {
  return {
    riskWeight: row.riskWeight,
    urgencyWeight: row.urgencyWeight,
    businessImpactWeight: row.businessImpactWeight,
    slaWeight: row.slaWeight,
    confidenceWeight: row.confidenceWeight,
  };
}

export async function writeDecisionHistory(input: {
  organizationId?: string;
  decisionId: string;
  action: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  actorUserId?: string | null;
  actorName?: string | null;
  reason?: string | null;
  notes?: string | null;
  metadata?: unknown;
}) {
  return prisma.decisionHistoryEvent.create({
    data: {
      organizationId: input.organizationId ?? DEFAULT_ORG_ID,
      decisionId: input.decisionId,
      action: input.action,
      fromStatus: input.fromStatus ?? null,
      toStatus: input.toStatus ?? null,
      actorUserId: input.actorUserId ?? null,
      actorName: input.actorName ?? null,
      reason: input.reason ?? null,
      notes: input.notes ?? null,
      metadataJson: JSON.stringify(input.metadata ?? {}),
    },
  });
}
