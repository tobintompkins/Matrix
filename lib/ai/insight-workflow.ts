/**
 * Patch 51A.1 Part 2 — Insight status workflow + mapping.
 */

import { prisma } from "@/lib/db/prisma";
import { writeAdminAudit } from "@/lib/admin/repository";
import {
  AI_INSIGHT_TRANSITIONS,
  type AiInsightStatus,
  type AiOpsInsightDto,
  type AiOpsInsightEventDto,
} from "./insight-types";
import { notifyAiOperationsEvent } from "./notifications";

export { AI_INSIGHT_TRANSITIONS };

export function mapInsight(row: {
  id: string;
  organizationId: string;
  analysisRunId: string | null;
  insightType: string;
  sourceModule: string;
  title: string;
  summary: string;
  explanation: string;
  recommendedAction: string;
  severity: string;
  confidence: number;
  status: string;
  riskCategory: string;
  supportingEvidence: string | null;
  limitations: string | null;
  analysisVersion: string;
  customerId: string | null;
  customerName: string | null;
  siteId: string | null;
  siteName: string | null;
  machineId: string | null;
  machineLabel: string | null;
  serviceCallId: string | null;
  pmRecordId: string | null;
  inventoryItemId: string | null;
  partId: string | null;
  dataQualityIssueId: string | null;
  relatedRecordHref: string | null;
  assignedReviewerId: string | null;
  assignedReviewerName: string | null;
  reviewNotes: string | null;
  dismissalReason: string | null;
  resolutionSummary: string | null;
  actionTaken: string | null;
  followUpDate: Date | null;
  resolvedAt: Date | null;
  archivedAt: Date | null;
  acknowledgedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): AiOpsInsightDto {
  let evidence: Record<string, unknown> | null = null;
  if (row.supportingEvidence) {
    try {
      evidence = JSON.parse(row.supportingEvidence) as Record<string, unknown>;
    } catch {
      evidence = { raw: row.supportingEvidence };
    }
  }
  return {
    id: row.id,
    organizationId: row.organizationId,
    analysisRunId: row.analysisRunId,
    insightType: row.insightType as AiOpsInsightDto["insightType"],
    sourceModule: row.sourceModule as AiOpsInsightDto["sourceModule"],
    title: row.title,
    summary: row.summary,
    explanation: row.explanation,
    recommendedAction: row.recommendedAction,
    severity: row.severity as AiOpsInsightDto["severity"],
    confidence: row.confidence,
    status: row.status as AiInsightStatus,
    riskCategory: row.riskCategory as AiOpsInsightDto["riskCategory"],
    supportingEvidence: evidence,
    limitations: row.limitations,
    analysisVersion: row.analysisVersion,
    customerId: row.customerId,
    customerName: row.customerName,
    siteId: row.siteId,
    siteName: row.siteName,
    machineId: row.machineId,
    machineLabel: row.machineLabel,
    serviceCallId: row.serviceCallId,
    pmRecordId: row.pmRecordId,
    inventoryItemId: row.inventoryItemId,
    partId: row.partId,
    dataQualityIssueId: row.dataQualityIssueId,
    relatedRecordHref: row.relatedRecordHref,
    assignedReviewerId: row.assignedReviewerId,
    assignedReviewerName: row.assignedReviewerName,
    reviewNotes: row.reviewNotes,
    dismissalReason: row.dismissalReason,
    resolutionSummary: row.resolutionSummary,
    actionTaken: row.actionTaken,
    followUpDate: row.followUpDate?.toISOString() ?? null,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    acknowledgedAt: row.acknowledgedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function canTransition(
  from: AiInsightStatus,
  to: AiInsightStatus,
): boolean {
  return AI_INSIGHT_TRANSITIONS[from]?.includes(to) ?? false;
}

async function appendEvent(input: {
  insightId: string;
  actorUserId?: string | null;
  actorName?: string | null;
  action: string;
  previousStatus?: string | null;
  newStatus?: string | null;
  note?: string | null;
}) {
  return prisma.aiOpsInsightEvent.create({
    data: {
      insightId: input.insightId,
      actorUserId: input.actorUserId ?? null,
      actorName: input.actorName ?? null,
      action: input.action,
      previousStatus: input.previousStatus ?? null,
      newStatus: input.newStatus ?? null,
      note: input.note ?? null,
    },
  });
}

export type WorkflowActor = {
  userId: string;
  displayName: string;
  organizationId: string;
};

export async function transitionInsight(input: {
  insightId: string;
  organizationId: string;
  actor: WorkflowActor;
  nextStatus: AiInsightStatus;
  action: string;
  note?: string | null;
  dismissalReason?: string | null;
  resolutionSummary?: string | null;
  actionTaken?: string | null;
  followUpDate?: string | null;
  assignedReviewerId?: string | null;
  assignedReviewerName?: string | null;
  allowOverride?: boolean;
}): Promise<{ ok: true; insight: AiOpsInsightDto } | { ok: false; error: string }> {
  const row = await prisma.aiOpsInsight.findFirst({
    where: { id: input.insightId, organizationId: input.organizationId },
  });
  if (!row) return { ok: false, error: "Insight not found." };

  const from = row.status as AiInsightStatus;
  const to = input.nextStatus;
  if (from !== to && !canTransition(from, to) && !input.allowOverride) {
    return {
      ok: false,
      error: `Invalid status transition ${from} → ${to}.`,
    };
  }
  if (to === "DISMISSED" && (!input.dismissalReason || input.dismissalReason.trim().length < 3)) {
    return { ok: false, error: "A dismissal reason is required." };
  }
  if (to === "RESOLVED" && (!input.resolutionSummary || input.resolutionSummary.trim().length < 3)) {
    return { ok: false, error: "A resolution summary is required." };
  }

  const now = new Date();
  const updated = await prisma.aiOpsInsight.update({
    where: { id: row.id },
    data: {
      status: to,
      reviewNotes: input.note
        ? [row.reviewNotes, input.note].filter(Boolean).join("\n---\n")
        : row.reviewNotes,
      dismissalReason: to === "DISMISSED" ? input.dismissalReason : row.dismissalReason,
      resolutionSummary:
        to === "RESOLVED" ? input.resolutionSummary : row.resolutionSummary,
      actionTaken: input.actionTaken ?? row.actionTaken,
      followUpDate: input.followUpDate ? new Date(input.followUpDate) : row.followUpDate,
      assignedReviewerId:
        input.assignedReviewerId !== undefined
          ? input.assignedReviewerId
          : row.assignedReviewerId,
      assignedReviewerName:
        input.assignedReviewerName !== undefined
          ? input.assignedReviewerName
          : row.assignedReviewerName,
      acknowledgedAt:
        to === "ACKNOWLEDGED" || to === "REVIEWING"
          ? row.acknowledgedAt ?? now
          : row.acknowledgedAt,
      resolvedAt: to === "RESOLVED" ? now : row.resolvedAt,
      archivedAt: to === "ARCHIVED" ? now : row.archivedAt,
    },
  });

  await appendEvent({
    insightId: row.id,
    actorUserId: input.actor.userId,
    actorName: input.actor.displayName,
    action: input.action,
    previousStatus: from,
    newStatus: to,
    note: input.note ?? input.dismissalReason ?? input.resolutionSummary ?? null,
  });

  await writeAdminAudit({
    organizationId: input.organizationId,
    actorId: input.actor.userId,
    action: input.action,
    entityType: "AiOpsInsight",
    entityId: row.id,
    payload: {
      previousStatus: from,
      newStatus: to,
      reason: input.dismissalReason ?? input.resolutionSummary ?? input.note ?? null,
    },
    category: "DATA_CHANGE",
    severity: "INFO",
    outcome: "SUCCESS",
  });

  if (
    input.action === "INSIGHT_ASSIGNED" &&
    input.assignedReviewerId
  ) {
    notifyAiOperationsEvent({
      type: "AI_INSIGHT_ASSIGNED",
      title: "AI insight assigned to you",
      message: updated.title,
      insightId: updated.id,
      userIds: [input.assignedReviewerId],
      priority: "HIGH",
    });
  }
  if (input.action === "INSIGHT_RESTORED" && to === "NEW") {
    notifyAiOperationsEvent({
      type: "AI_INSIGHT_RESTORED",
      title: "Dismissed AI insight restored",
      message: updated.title,
      insightId: updated.id,
      priority: "NORMAL",
    });
  }

  return { ok: true, insight: mapInsight(updated) };
}

export async function listInsightEvents(
  insightId: string,
): Promise<AiOpsInsightEventDto[]> {
  const rows = await prisma.aiOpsInsightEvent.findMany({
    where: { insightId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return rows.map((e) => ({
    id: e.id,
    insightId: e.insightId,
    actorUserId: e.actorUserId,
    actorName: e.actorName,
    action: e.action,
    previousStatus: e.previousStatus,
    newStatus: e.newStatus,
    note: e.note,
    createdAt: e.createdAt.toISOString(),
  }));
}
