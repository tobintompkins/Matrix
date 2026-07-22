/**
 * Patch 51A.4 — Executive / summary analytics from real decision rows.
 */

import { prisma } from "@/lib/db/prisma";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import { OPEN_DECISION_STATUSES } from "./types";

export async function getDecisionSummary(organizationId = DEFAULT_ORG_ID) {
  const rows = await prisma.decisionRecommendation.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: 2000,
  });

  const open = rows.filter((r) =>
    OPEN_DECISION_STATUSES.includes(r.status as (typeof OPEN_DECISION_STATUSES)[number]),
  );
  const critical = open.filter((r) => r.priority === "CRITICAL").length;
  const awaitingReview = open.filter((r) =>
    ["NEW", "REVIEW_REQUIRED"].includes(r.status),
  ).length;
  const approvedInProgress = open.filter((r) =>
    ["APPROVED", "ASSIGNED", "IN_PROGRESS"].includes(r.status),
  ).length;

  const downtimeAvoided = rows
    .filter((r) => r.status === "COMPLETED" && r.outcomeDowntimeAvoided)
    .reduce((s, r) => s + (r.estimatedDowntimeMinutes ?? 0), 0);

  const costAvoided = rows
    .filter((r) => r.status === "COMPLETED")
    .reduce((s, r) => s + (r.estimatedCostAvoidance ?? 0), 0);

  const completed = rows.filter((r) => r.status === "COMPLETED");
  const rejected = rows.filter((r) => r.status === "REJECTED");
  const acceptanceRate =
    completed.length + rejected.length === 0
      ? null
      : Math.round(
          (completed.length / (completed.length + rejected.length)) * 100,
        );

  const byCustomer = new Map<string, { risk: number; count: number }>();
  for (const r of open) {
    const key = r.customerId || r.siteId || "Unassigned";
    const cur = byCustomer.get(key) ?? { risk: 0, count: 0 };
    cur.count += 1;
    cur.risk += r.riskScore;
    byCustomer.set(key, cur);
  }

  const fleetRisk = [...byCustomer.entries()]
    .map(([name, v]) => ({
      name,
      decisions: v.count,
      avgRisk: Math.round(v.risk / Math.max(1, v.count)),
    }))
    .sort((a, b) => b.avgRisk - a.avgRisk)
    .slice(0, 8);

  const topMachines = open
    .filter((r) => r.machineId)
    .sort((a, b) => b.overallDecisionScore - a.overallDecisionScore)
    .slice(0, 8)
    .map((r) => ({
      machineId: r.machineId!,
      title: r.title,
      priority: r.priority,
      overallDecisionScore: r.overallDecisionScore,
      decisionId: r.id,
    }));

  const slaThreats = open
    .filter((r) => r.decisionType === "SLA_RISK" || r.slaImpact)
    .slice(0, 8);

  const completedOverTime = new Map<string, number>();
  for (const r of completed) {
    const day = (r.completedAt ?? r.updatedAt).toISOString().slice(0, 10);
    completedOverTime.set(day, (completedOverTime.get(day) ?? 0) + 1);
  }

  return {
    critical,
    awaitingReview,
    approvedInProgress,
    estimatedDowntimeAvoidedMinutes: downtimeAvoided,
    estimatedCostAvoided: Math.round(costAvoided),
    openCount: open.length,
    completedCount: completed.length,
    rejectedCount: rejected.length,
    acceptanceRate,
    topDecisions: open
      .slice()
      .sort((a, b) => b.overallDecisionScore - a.overallDecisionScore)
      .slice(0, 8),
    fleetRisk,
    topMachines,
    slaThreats,
    predictedDowntimeMinutes: open.reduce(
      (s, r) => s + (r.estimatedDowntimeMinutes ?? 0),
      0,
    ),
    estimatedCostExposure: Math.round(
      open.reduce((s, r) => s + (r.estimatedCost ?? 0), 0),
    ),
    completedSeries: [...completedOverTime.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count })),
    empty: rows.length === 0,
  };
}

export function serializeDecision(
  row: {
    id: string;
    organizationId: string;
    decisionType: string;
    title: string;
    summary: string;
    detailedReasoning: string;
    sourceType: string;
    sourceId: string | null;
    fingerprint: string;
    customerId: string | null;
    siteId: string | null;
    machineId: string | null;
    serviceCallId: string | null;
    preventiveMaintenanceId: string | null;
    technicianId: string | null;
    partId: string | null;
    inventoryLocationId: string | null;
    priority: string;
    status: string;
    confidenceScore: number;
    riskScore: number;
    urgencyScore: number;
    businessImpactScore: number;
    overallDecisionScore: number;
    estimatedDowntimeMinutes: number | null;
    estimatedLaborMinutes: number | null;
    estimatedCost: number | null;
    estimatedCostAvoidance: number | null;
    slaImpact: string | null;
    recommendedAction: string;
    alternativeActionsJson: string;
    evidenceSnapshotJson: string;
    highImpact: boolean;
    rulesVersion: string;
    aiProvider: string | null;
    aiModel: string | null;
    aiExplanationVersion: string | null;
    aiExplanationJson: string | null;
    assignedToUserId: string | null;
    dueAt: Date | null;
    reviewedAt: Date | null;
    reviewedBy: string | null;
    approvedAt: Date | null;
    approvedBy: string | null;
    rejectedAt: Date | null;
    rejectedBy: string | null;
    rejectionReason: string | null;
    deferredUntil: Date | null;
    completedAt: Date | null;
    completedBy: string | null;
    completionNotes: string | null;
    usefulRating: number | null;
    outcomeUseful: boolean | null;
    outcomeConfirmed: boolean | null;
    outcomeDowntimeAvoided: boolean | null;
    outcomeActualLaborMinutes: number | null;
    outcomeActualCost: number | null;
    createdAt: Date;
    updatedAt: Date;
  } | null,
  options?: { includeCosts?: boolean },
) {
  if (!row) return null;
  const includeCosts = options?.includeCosts !== false;
  let evidence = {};
  let alternatives: unknown[] = [];
  let aiExplanation = null;
  try {
    evidence = JSON.parse(row.evidenceSnapshotJson || "{}");
  } catch {
    evidence = {};
  }
  try {
    alternatives = JSON.parse(row.alternativeActionsJson || "[]");
  } catch {
    alternatives = [];
  }
  try {
    aiExplanation = row.aiExplanationJson
      ? JSON.parse(row.aiExplanationJson)
      : null;
  } catch {
    aiExplanation = null;
  }

  return {
    id: row.id,
    organizationId: row.organizationId,
    decisionType: row.decisionType,
    title: row.title,
    summary: row.summary,
    detailedReasoning: row.detailedReasoning,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    fingerprint: row.fingerprint,
    customerId: row.customerId,
    siteId: row.siteId,
    machineId: row.machineId,
    serviceCallId: row.serviceCallId,
    preventiveMaintenanceId: row.preventiveMaintenanceId,
    technicianId: row.technicianId,
    partId: row.partId,
    inventoryLocationId: row.inventoryLocationId,
    priority: row.priority,
    status: row.status,
    confidenceScore: row.confidenceScore,
    riskScore: row.riskScore,
    urgencyScore: row.urgencyScore,
    businessImpactScore: row.businessImpactScore,
    overallDecisionScore: row.overallDecisionScore,
    estimatedDowntimeMinutes: row.estimatedDowntimeMinutes,
    estimatedLaborMinutes: row.estimatedLaborMinutes,
    estimatedCost: includeCosts ? row.estimatedCost : null,
    estimatedCostAvoidance: includeCosts ? row.estimatedCostAvoidance : null,
    costsHidden: !includeCosts,
    slaImpact: row.slaImpact,
    recommendedAction: row.recommendedAction,
    alternativeActions: alternatives,
    evidence,
    highImpact: row.highImpact,
    rulesVersion: row.rulesVersion,
    aiProvider: row.aiProvider,
    aiModel: row.aiModel,
    aiExplanationVersion: row.aiExplanationVersion,
    aiExplanation,
    assignedToUserId: row.assignedToUserId,
    dueAt: row.dueAt?.toISOString() ?? null,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    reviewedBy: row.reviewedBy,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    approvedBy: row.approvedBy,
    rejectedAt: row.rejectedAt?.toISOString() ?? null,
    rejectedBy: row.rejectedBy,
    rejectionReason: row.rejectionReason,
    deferredUntil: row.deferredUntil?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    completedBy: row.completedBy,
    completionNotes: row.completionNotes,
    usefulRating: row.usefulRating,
    outcomeUseful: row.outcomeUseful,
    outcomeConfirmed: row.outcomeConfirmed,
    outcomeDowntimeAvoided: row.outcomeDowntimeAvoided,
    outcomeActualLaborMinutes: row.outcomeActualLaborMinutes,
    outcomeActualCost: includeCosts ? row.outcomeActualCost : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
