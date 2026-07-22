/**
 * Patch 51A.3 — Retention purge for predictive snapshots / alerts / runs.
 */

import { prisma } from "@/lib/db/prisma";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import {
  getOrCreatePredictiveSettings,
  settingsToDefaults,
  writePredictiveAudit,
} from "./settings";

export async function purgePredictiveRetention(input?: {
  organizationId?: string;
}) {
  const organizationId = input?.organizationId ?? DEFAULT_ORG_ID;
  const settings = settingsToDefaults(
    await getOrCreatePredictiveSettings(organizationId),
  );
  const days = Math.max(30, settings.retentionDays || 180);
  const cutoff = new Date(Date.now() - days * 86_400_000);

  const [snapshots, alerts, runs] = await Promise.all([
    prisma.machineHealthSnapshot.deleteMany({
      where: { organizationId, generatedAt: { lt: cutoff } },
    }),
    prisma.predictiveRiskAlert.deleteMany({
      where: {
        organizationId,
        status: { in: ["RESOLVED", "DISMISSED"] },
        updatedAt: { lt: cutoff },
      },
    }),
    prisma.predictiveMaintenanceRun.deleteMany({
      where: { organizationId, startedAt: { lt: cutoff } },
    }),
  ]);

  await writePredictiveAudit({
    organizationId,
    action: "predictive.retention_purged",
    entityType: "PredictiveRetention",
    payload: {
      cutoff: cutoff.toISOString(),
      retentionDays: days,
      snapshotsDeleted: snapshots.count,
      alertsDeleted: alerts.count,
      runsDeleted: runs.count,
    },
  });

  return {
    cutoff: cutoff.toISOString(),
    retentionDays: days,
    snapshotsDeleted: snapshots.count,
    alertsDeleted: alerts.count,
    runsDeleted: runs.count,
  };
}
