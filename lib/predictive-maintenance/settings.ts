/**
 * Patch 51A.3 — Settings + scoring profile repository.
 */

import { prisma } from "@/lib/db/prisma";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import {
  DEFAULT_PREDICTIVE_SETTINGS,
  DEFAULT_WEIGHTS,
  SCORING_VERSION,
  type DefaultPredictiveSettings,
} from "./types";

export async function getOrCreatePredictiveSettings(
  organizationId = DEFAULT_ORG_ID,
) {
  const existing = await prisma.predictiveMaintenanceSetting.findUnique({
    where: { organizationId },
  });
  if (existing) return existing;
  return prisma.predictiveMaintenanceSetting.create({
    data: {
      organizationId,
      ...DEFAULT_PREDICTIVE_SETTINGS,
    },
  });
}

export function settingsToDefaults(
  row: Awaited<ReturnType<typeof getOrCreatePredictiveSettings>>,
): DefaultPredictiveSettings {
  return {
    enabled: row.enabled,
    scheduledEvaluationEnabled: row.scheduledEvaluationEnabled,
    evaluationFrequency: row.evaluationFrequency,
    healthScoreWarningThreshold: row.healthScoreWarningThreshold,
    healthScoreCriticalThreshold: row.healthScoreCriticalThreshold,
    pmDueSoonDays: row.pmDueSoonDays,
    staleMeterDays: row.staleMeterDays,
    repeatFailureLookbackDays: row.repeatFailureLookbackDays,
    repeatFailureThreshold: row.repeatFailureThreshold,
    downtimeLookbackDays: row.downtimeLookbackDays,
    usageSpikePercent: row.usageSpikePercent,
    minimumDataQualityScore: row.minimumDataQualityScore,
    minimumConfidenceForAlert: row.minimumConfidenceForAlert,
    autoCreateRecommendations: row.autoCreateRecommendations,
    autoCreateInternalAlerts: row.autoCreateInternalAlerts,
    requireApprovalForServiceCallCreation:
      row.requireApprovalForServiceCallCreation,
    retentionDays: row.retentionDays,
    scoringVersion: row.scoringVersion || SCORING_VERSION,
  };
}

export async function updatePredictiveSettings(
  organizationId: string,
  patch: Partial<DefaultPredictiveSettings>,
  actorUserId?: string | null,
) {
  await getOrCreatePredictiveSettings(organizationId);
  const updated = await prisma.predictiveMaintenanceSetting.update({
    where: { organizationId },
    data: {
      ...patch,
      updatedAt: new Date(),
    },
  });
  await writePredictiveAudit({
    organizationId,
    action: "predictive.settings_updated",
    entityType: "PredictiveMaintenanceSetting",
    entityId: updated.id,
    actorUserId,
    payload: patch,
  });
  return updated;
}

export async function getOrCreateDefaultScoringProfile(
  organizationId = DEFAULT_ORG_ID,
) {
  const existing = await prisma.predictiveScoringProfile.findFirst({
    where: { organizationId, isDefault: true, isActive: true },
  });
  if (existing) return existing;
  return prisma.predictiveScoringProfile.create({
    data: {
      organizationId,
      name: "Default fleet scoring",
      description:
        "Explainable default weights for PM urgency, repeat failure, usage, and data quality.",
      isDefault: true,
      isActive: true,
      weightsJson: JSON.stringify(DEFAULT_WEIGHTS),
      thresholdsJson: JSON.stringify({
        warning: DEFAULT_PREDICTIVE_SETTINGS.healthScoreWarningThreshold,
        critical: DEFAULT_PREDICTIVE_SETTINGS.healthScoreCriticalThreshold,
      }),
      version: "1",
    },
  });
}

export async function writePredictiveAudit(input: {
  organizationId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  actorUserId?: string | null;
  payload?: unknown;
}) {
  return prisma.predictiveAuditEvent.create({
    data: {
      organizationId: input.organizationId ?? DEFAULT_ORG_ID,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      actorUserId: input.actorUserId ?? null,
      payloadJson: JSON.stringify(input.payload ?? {}),
    },
  });
}
