/**
 * Patch 51A.3 — Evaluate machines and persist snapshots / recs / alerts.
 */

import { prisma } from "@/lib/db/prisma";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import { evaluateMachineDeterministic } from "./scoring-engine";
import { gatherMachinePredictiveInput, listPredictiveMachineIds } from "./gather-input";
import {
  getOrCreateDefaultScoringProfile,
  getOrCreatePredictiveSettings,
  settingsToDefaults,
  writePredictiveAudit,
} from "./settings";
import {
  parseScoringWeights,
  applyProfileThresholds,
} from "./scoring-profile";
import { emitPredictiveEvent } from "./emit";
import { summarizeMachineHealth } from "./ai-assist";
import type { EvaluationResult } from "./types";

export async function evaluateSingleMachine(input: {
  machineId: string;
  organizationId?: string;
  runId?: string | null;
  runType?: "MANUAL" | "SCHEDULED" | "EVENT_TRIGGERED" | "BACKFILL";
  initiatedById?: string | null;
  includeAiExplanation?: boolean;
}): Promise<{ ok: true; result: EvaluationResult; snapshotId: string } | { ok: false; error: string }> {
  const organizationId = input.organizationId ?? DEFAULT_ORG_ID;
  const settingsRow = await getOrCreatePredictiveSettings(organizationId);
  const profile = await getOrCreateDefaultScoringProfile(organizationId);
  const weights = parseScoringWeights(profile.weightsJson);
  let settings = settingsToDefaults(settingsRow);
  settings = applyProfileThresholds(settings, profile.thresholdsJson);

  if (!settings.enabled) {
    return { ok: false, error: "Predictive maintenance is disabled for this organization." };
  }

  const machineInput = await gatherMachinePredictiveInput(input.machineId);
  if (!machineInput) {
    return { ok: false, error: "Machine not found in PM state or digital twin." };
  }

  const previous = await prisma.machineHealthSnapshot.findFirst({
    where: { organizationId, machineId: input.machineId },
    orderBy: { generatedAt: "desc" },
  });

  const result = evaluateMachineDeterministic(machineInput, settings, weights);

  // Patch previous score into alerts for drop detection
  if (previous) {
    const drop = previous.healthScore - result.healthScore;
    if (drop >= 15) {
      result.alerts.push({
        alertType: "HEALTH_SCORE_DROP",
        severity: "HIGH",
        title: `Health score drop — ${input.machineId}`,
        message: `Score fell from ${previous.healthScore} to ${result.healthScore}.`,
        dedupeKey: `score-drop:${input.machineId}:${new Date().toISOString().slice(0, 10)}`,
      });
    }
  }

  let aiExplanationJson: string | null = null;
  let aiExplanationVersion: string | null = null;
  if (input.includeAiExplanation !== false) {
    const explanation = await summarizeMachineHealth(result);
    aiExplanationJson = JSON.stringify(explanation);
    aiExplanationVersion = explanation.promptVersion;
  }

  const snapshot = await prisma.machineHealthSnapshot.create({
    data: {
      organizationId,
      machineId: input.machineId,
      healthScore: result.healthScore,
      riskLevel: result.riskLevel,
      failureRiskScore: result.failureRiskScore,
      pmUrgencyScore: result.pmUrgencyScore,
      usageStressScore: result.usageStressScore,
      repeatIssueScore: result.repeatIssueScore,
      downtimeRiskScore: result.downtimeRiskScore,
      dataQualityScore: result.dataQualityScore,
      confidenceScore: result.confidenceScore,
      predictedMaintenanceDate: result.forecast.predictedDueDate
        ? new Date(result.forecast.predictedDueDate)
        : null,
      predictedMaintenanceWindowStart: result.forecast.windowStart
        ? new Date(result.forecast.windowStart)
        : null,
      predictedMaintenanceWindowEnd: result.forecast.windowEnd
        ? new Date(result.forecast.windowEnd)
        : null,
      primaryRiskReason: result.primaryRiskReason,
      riskFactorsJson: JSON.stringify(result.riskFactors),
      recommendationsJson: JSON.stringify(result.recommendations),
      inputSummaryJson: JSON.stringify(result.inputSummary),
      scoringVersion: result.scoringVersion,
      aiExplanationVersion,
      aiExplanationJson,
      runId: input.runId ?? null,
      generatedAt: new Date(),
    },
  });

  let recommendationsCreated = 0;
  let alertsCreated = 0;

  if (settings.autoCreateRecommendations) {
    for (const rec of result.recommendations) {
      if (rec.recommendationType === "MONITOR" && result.riskLevel === "LOW") {
        // Still store monitor for transparency on non-low? skip duplicates of MONITOR when low
      }
      const existing = await prisma.predictiveMaintenanceRecommendation.findFirst({
        where: {
          organizationId,
          dedupeKey: rec.dedupeKey,
          status: { in: ["OPEN", "ACKNOWLEDGED", "ACCEPTED"] },
        },
      });
      if (existing) continue;
      await prisma.predictiveMaintenanceRecommendation.create({
        data: {
          organizationId,
          machineId: input.machineId,
          healthSnapshotId: snapshot.id,
          recommendationType: rec.recommendationType,
          priority: rec.priority,
          title: rec.title,
          description: rec.description,
          reason: rec.reason,
          confidenceScore: rec.confidenceScore,
          dedupeKey: rec.dedupeKey,
          status: "OPEN",
        },
      });
      recommendationsCreated += 1;
      await emitPredictiveEvent({
        eventType: "predictive.recommendation_created",
        machineId: input.machineId,
        organizationId,
        payload: {
          machineId: input.machineId,
          healthSnapshotId: snapshot.id,
          recommendationType: rec.recommendationType,
          priority: rec.priority,
        },
      });
    }
  }

  if (settings.autoCreateInternalAlerts) {
    for (const alert of result.alerts) {
      if (result.confidenceScore < settings.minimumConfidenceForAlert) {
        if (alert.severity !== "CRITICAL" && alert.alertType !== "CRITICAL_RISK") {
          continue;
        }
      }
      try {
        const existingOpen = await prisma.predictiveRiskAlert.findFirst({
          where: {
            organizationId,
            dedupeKey: alert.dedupeKey,
            status: "OPEN",
          },
        });
        if (existingOpen) continue;
        await prisma.predictiveRiskAlert.create({
          data: {
            organizationId,
            machineId: input.machineId,
            healthSnapshotId: snapshot.id,
            alertType: alert.alertType,
            severity: alert.severity,
            title: alert.title,
            message: alert.message,
            dedupeKey: alert.dedupeKey,
            status: "OPEN",
          },
        });
        alertsCreated += 1;
        await emitPredictiveEvent({
          eventType: "predictive.alert_created",
          machineId: input.machineId,
          organizationId,
          payload: {
            machineId: input.machineId,
            healthSnapshotId: snapshot.id,
            alertType: alert.alertType,
            severity: alert.severity,
          },
        });
      } catch {
        // skip duplicate / transient write errors
      }
    }
  }

  // Predictive automation signals
  const payloadBase = {
    machineId: input.machineId,
    healthSnapshotId: snapshot.id,
    healthScore: result.healthScore,
    previousHealthScore: previous?.healthScore ?? null,
    riskLevel: result.riskLevel,
    confidenceScore: result.confidenceScore,
    primaryRiskReason: result.primaryRiskReason,
  };

  if (previous && previous.healthScore !== result.healthScore) {
    await emitPredictiveEvent({
      eventType: "predictive.health_score_changed",
      machineId: input.machineId,
      organizationId,
      payload: payloadBase,
    });
  }
  if (result.riskLevel === "HIGH") {
    await emitPredictiveEvent({
      eventType: "predictive.machine_high_risk",
      machineId: input.machineId,
      organizationId,
      payload: payloadBase,
    });
  }
  if (result.riskLevel === "CRITICAL") {
    await emitPredictiveEvent({
      eventType: "predictive.machine_critical_risk",
      machineId: input.machineId,
      organizationId,
      payload: payloadBase,
    });
  }
  if (
    result.forecast.windowStart &&
    result.forecast.daysRemaining != null &&
    result.forecast.daysRemaining <= 14 &&
    result.forecast.daysRemaining >= 0
  ) {
    await emitPredictiveEvent({
      eventType: "predictive.maintenance_window_opened",
      machineId: input.machineId,
      organizationId,
      payload: { ...payloadBase, windowStart: result.forecast.windowStart },
    });
  }
  if (result.riskFactors.some((f) => f.key === "PM_OVERDUE")) {
    await emitPredictiveEvent({
      eventType: "predictive.pm_likely_overdue",
      machineId: input.machineId,
      organizationId,
      payload: payloadBase,
    });
  }
  if (result.riskFactors.some((f) => f.key === "REPEAT_FAILURE")) {
    await emitPredictiveEvent({
      eventType: "predictive.repeat_failure_detected",
      machineId: input.machineId,
      organizationId,
      payload: payloadBase,
    });
  }
  if (result.dataQualityScore < settings.minimumDataQualityScore) {
    await emitPredictiveEvent({
      eventType: "predictive.data_quality_low",
      machineId: input.machineId,
      organizationId,
      payload: payloadBase,
    });
  }

  // Patch 51A.4 — feed Decision Engine (recommendations only; no high-impact auto-exec)
  if (result.riskLevel === "HIGH" || result.riskLevel === "CRITICAL") {
    try {
      const { generateFromPredictiveAlert } = await import(
        "@/lib/decision-engine/generate"
      );
      await generateFromPredictiveAlert({
        machineId: input.machineId,
        healthSnapshotId: snapshot.id,
        riskLevel: result.riskLevel,
        organizationId,
        actorUserId: input.initiatedById ?? null,
        actorName: "Predictive Maintenance",
      });
    } catch {
      /* decision engine must not fail predictive scoring */
    }
  }

  await writePredictiveAudit({
    organizationId,
    action: "predictive.machine_evaluated",
    entityType: "MachineHealthSnapshot",
    entityId: snapshot.id,
    actorUserId: input.initiatedById,
    payload: {
      machineId: input.machineId,
      healthScore: result.healthScore,
      riskLevel: result.riskLevel,
      recommendationsCreated,
      alertsCreated,
    },
  });

  return { ok: true, result, snapshotId: snapshot.id };
}

export async function runPredictiveBatch(input: {
  organizationId?: string;
  machineIds?: string[];
  runType?: "MANUAL" | "SCHEDULED" | "EVENT_TRIGGERED" | "BACKFILL";
  initiatedById?: string | null;
  batchSize?: number;
}) {
  const organizationId = input.organizationId ?? DEFAULT_ORG_ID;
  const settingsRow = await getOrCreatePredictiveSettings(organizationId);
  const settings = settingsToDefaults(settingsRow);

  const run = await prisma.predictiveMaintenanceRun.create({
    data: {
      organizationId,
      runType: input.runType ?? "MANUAL",
      status: "RUNNING",
      scopeJson: JSON.stringify({
        machineIds: input.machineIds ?? "active_fleet",
        batchSize: input.batchSize ?? 50,
      }),
      scoringVersion: settings.scoringVersion,
      initiatedById: input.initiatedById ?? null,
      startedAt: new Date(),
    },
  });

  const ids =
    input.machineIds?.length
      ? input.machineIds
      : await listPredictiveMachineIds(input.batchSize ?? 50);

  let evaluated = 0;
  let recs = 0;
  let alerts = 0;
  let errors = 0;
  const errorList: Array<{ machineId: string; error: string }> = [];

  for (const machineId of ids) {
    try {
      const beforeRecs = await prisma.predictiveMaintenanceRecommendation.count({
        where: { organizationId },
      });
      const beforeAlerts = await prisma.predictiveRiskAlert.count({
        where: { organizationId, status: "OPEN" },
      });
      const result = await evaluateSingleMachine({
        machineId,
        organizationId,
        runId: run.id,
        runType: input.runType,
        initiatedById: input.initiatedById,
      });
      if (!result.ok) {
        errors += 1;
        errorList.push({ machineId, error: result.error });
        continue;
      }
      evaluated += 1;
      const afterRecs = await prisma.predictiveMaintenanceRecommendation.count({
        where: { organizationId },
      });
      const afterAlerts = await prisma.predictiveRiskAlert.count({
        where: { organizationId, status: "OPEN" },
      });
      recs += Math.max(0, afterRecs - beforeRecs);
      alerts += Math.max(0, afterAlerts - beforeAlerts);
    } catch (e) {
      errors += 1;
      errorList.push({
        machineId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const status =
    errors === 0 ? "SUCCEEDED" : evaluated > 0 ? "PARTIAL" : "FAILED";

  const updated = await prisma.predictiveMaintenanceRun.update({
    where: { id: run.id },
    data: {
      status,
      machinesEvaluated: evaluated,
      recommendationsCreated: recs,
      alertsCreated: alerts,
      errorsCount: errors,
      errorJson: errorList.length ? JSON.stringify(errorList) : null,
      completedAt: new Date(),
    },
  });

  await writePredictiveAudit({
    organizationId,
    action: "predictive.batch_run_completed",
    entityType: "PredictiveMaintenanceRun",
    entityId: run.id,
    actorUserId: input.initiatedById,
    payload: { status, evaluated, errors },
  });

  return updated;
}
