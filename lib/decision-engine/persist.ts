/**
 * Patch 51A.4 — Upsert decision recommendations with fingerprint dedupe.
 */

import { prisma } from "@/lib/db/prisma";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import { writeAdminAudit } from "@/lib/admin/repository";
import {
  DECISION_AI_EXPLANATION_VERSION,
  DECISION_RULES_VERSION,
  OPEN_DECISION_STATUSES,
  type DraftDecision,
} from "./types";
import { writeDecisionHistory } from "./settings";
import { explainDecisionDeterministic } from "./ai-explain";
import { notifyDecisionEvent } from "./notify";

export function buildFingerprint(
  decisionType: string,
  sourceType: string,
  sourceId: string | null | undefined,
  machineId?: string | null,
  partId?: string | null,
): string {
  return [
    decisionType,
    sourceType,
    sourceId ?? "",
    machineId ?? "",
    partId ?? "",
  ]
    .join("|")
    .toUpperCase();
}

export async function upsertDecisionRecommendation(input: {
  draft: DraftDecision;
  organizationId?: string;
  actorUserId?: string | null;
  actorName?: string | null;
  includeAiExplanation?: boolean;
}): Promise<{
  decision: Awaited<ReturnType<typeof prisma.decisionRecommendation.create>>;
  created: boolean;
  refreshed: boolean;
}> {
  const organizationId = input.organizationId ?? DEFAULT_ORG_ID;
  const draft = input.draft;
  const fingerprint =
    draft.fingerprint ||
    buildFingerprint(
      draft.decisionType,
      draft.sourceType,
      draft.sourceId,
      draft.machineId,
      draft.partId,
    );

  const openExisting = await prisma.decisionRecommendation.findFirst({
    where: {
      organizationId,
      fingerprint,
      status: { in: OPEN_DECISION_STATUSES },
    },
    orderBy: { updatedAt: "desc" },
  });

  const explanation =
    input.includeAiExplanation === false
      ? null
      : await explainDecisionDeterministic(draft);

  const baseData = {
    decisionType: draft.decisionType,
    title: draft.title,
    summary: draft.summary,
    detailedReasoning: draft.detailedReasoning,
    sourceType: draft.sourceType,
    sourceId: draft.sourceId ?? null,
    fingerprint,
    customerId: draft.customerId ?? null,
    siteId: draft.siteId ?? null,
    machineId: draft.machineId ?? null,
    serviceCallId: draft.serviceCallId ?? null,
    technicianId: draft.technicianId ?? null,
    partId: draft.partId ?? null,
    inventoryLocationId: draft.inventoryLocationId ?? null,
    priority: draft.priority,
    confidenceScore: draft.scores.confidenceScore,
    riskScore: draft.scores.riskScore,
    urgencyScore: draft.scores.urgencyScore,
    businessImpactScore: draft.scores.businessImpactScore,
    overallDecisionScore: draft.scores.overallDecisionScore,
    estimatedDowntimeMinutes: draft.estimatedDowntimeMinutes ?? null,
    estimatedLaborMinutes: draft.estimatedLaborMinutes ?? null,
    estimatedCost: draft.estimatedCost ?? null,
    estimatedCostAvoidance: draft.estimatedCostAvoidance ?? null,
    slaImpact: draft.slaImpact ?? null,
    recommendedAction: draft.recommendedAction,
    alternativeActionsJson: JSON.stringify(draft.alternativeActions),
    evidenceSnapshotJson: JSON.stringify(draft.evidence),
    highImpact: draft.highImpact,
    rulesVersion: DECISION_RULES_VERSION,
    dueAt: draft.dueAt ? new Date(draft.dueAt) : null,
    aiProvider: explanation?.provider ?? null,
    aiModel: explanation?.model ?? null,
    aiExplanationVersion: explanation
      ? DECISION_AI_EXPLANATION_VERSION
      : null,
    aiExplanationJson: explanation ? JSON.stringify(explanation) : null,
  };

  if (openExisting) {
    const updated = await prisma.decisionRecommendation.update({
      where: { id: openExisting.id },
      data: {
        ...baseData,
        // Keep human workflow state; refresh scores/evidence only
        status: openExisting.status,
      },
    });
    await writeDecisionHistory({
      organizationId,
      decisionId: updated.id,
      action: "REFRESHED",
      fromStatus: openExisting.status,
      toStatus: updated.status,
      actorUserId: input.actorUserId,
      actorName: input.actorName,
      notes: "Scores and evidence refreshed from current operational data.",
    });
    return { decision: updated, created: false, refreshed: true };
  }

  const initialStatus =
    draft.highImpact || draft.priority === "CRITICAL"
      ? "REVIEW_REQUIRED"
      : "NEW";

  const created = await prisma.decisionRecommendation.create({
    data: {
      organizationId,
      ...baseData,
      status: initialStatus,
    },
  });

  await writeDecisionHistory({
    organizationId,
    decisionId: created.id,
    action: "CREATED",
    fromStatus: null,
    toStatus: created.status,
    actorUserId: input.actorUserId,
    actorName: input.actorName,
    notes: "Decision recommendation generated.",
  });

  try {
    await writeAdminAudit({
      organizationId,
      actorId: input.actorUserId ?? null,
      action: "DECISION_RECOMMENDATION_CREATED",
      entityType: "DecisionRecommendation",
      entityId: created.id,
      message: created.title,
      payload: {
        decisionType: created.decisionType,
        priority: created.priority,
        status: created.status,
      },
      category: "AI_OPERATIONS",
      severity: "INFO",
      outcome: "SUCCESS",
    });
  } catch {
    /* audit is best-effort */
  }

  if (created.priority === "CRITICAL" || created.status === "REVIEW_REQUIRED") {
    notifyDecisionEvent({
      title:
        created.priority === "CRITICAL"
          ? `Critical decision: ${created.title}`
          : `Review needed: ${created.title}`,
      message: created.summary,
      decisionId: created.id,
      priority: created.priority === "CRITICAL" ? "URGENT" : "HIGH",
    });
  }

  return { decision: created, created: true, refreshed: false };
}

export async function expireStaleDecisions(organizationId = DEFAULT_ORG_ID) {
  const settings = await prisma.decisionEngineSetting.findUnique({
    where: { organizationId },
  });
  const days = settings?.autoExpireDays ?? 30;
  const cutoff = new Date(Date.now() - days * 86_400_000);
  const stale = await prisma.decisionRecommendation.findMany({
    where: {
      organizationId,
      status: { in: OPEN_DECISION_STATUSES },
      updatedAt: { lt: cutoff },
    },
    take: 100,
  });
  let expired = 0;
  for (const row of stale) {
    await prisma.decisionRecommendation.update({
      where: { id: row.id },
      data: { status: "EXPIRED" },
    });
    await writeDecisionHistory({
      organizationId,
      decisionId: row.id,
      action: "EXPIRED",
      fromStatus: row.status,
      toStatus: "EXPIRED",
      notes: `Auto-expired after ${days} days without update.`,
    });
    expired += 1;
  }
  return { expired };
}
