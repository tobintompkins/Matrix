import { writeAdminAudit } from "@/lib/admin/repository";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import { prisma } from "@/lib/db/prisma";
import { OFFICE_DISPATCHER_SIGNOFF_ACTIONS } from "./office-dispatcher-group";
import { OFFICE_PILOT_SIGNOFF_ACTIONS } from "./office-pilot";
import { OFFICE_ROLE_EXPANSION_SIGNOFF_ACTIONS } from "./office-role-expansion";
import {
  OFFICE_EXPANSION_REVIEW_ACTIONS,
  OFFICE_EXPANSION_REVIEW_AUDIT_ENTITY_TYPE,
  OFFICE_EXPANSION_REVIEW_ENTITY_ID,
  resolveExpansionReviewStatus,
  type OfficeExpansionReviewAuditEntry,
  type OfficeExpansionReviewDecision,
  type OfficeExpansionReviewStatus,
} from "./office-rollout-expansion-review";

export type OfficeExpansionReviewRecord = {
  status: OfficeExpansionReviewStatus;
  action: string | null;
  occurredAt: string | null;
  actorId: string | null;
  actorDisplayName: string | null;
  message: string | null;
};

export async function getLatestOfficeExpansionReview(): Promise<OfficeExpansionReviewRecord> {
  const row = await prisma.auditLog.findFirst({
    where: {
      entityType: OFFICE_EXPANSION_REVIEW_AUDIT_ENTITY_TYPE,
      entityId: OFFICE_EXPANSION_REVIEW_ENTITY_ID,
      action: { in: Object.values(OFFICE_EXPANSION_REVIEW_ACTIONS) },
    },
    orderBy: { createdAt: "desc" },
    select: {
      action: true,
      createdAt: true,
      actorId: true,
      message: true,
      payload: true,
    },
  });

  if (!row) {
    return {
      status: "none",
      action: null,
      occurredAt: null,
      actorId: null,
      actorDisplayName: null,
      message: null,
    };
  }

  let actorDisplayName: string | null = null;
  if (row.payload) {
    try {
      const parsed = JSON.parse(row.payload) as { actorDisplayName?: string };
      actorDisplayName = parsed.actorDisplayName ?? null;
    } catch {
      actorDisplayName = null;
    }
  }

  return {
    status: resolveExpansionReviewStatus(row.action),
    action: row.action,
    occurredAt: row.createdAt.toISOString(),
    actorId: row.actorId,
    actorDisplayName,
    message: row.message,
  };
}

export async function listOfficeExpansionReviewAudits(
  limit = 12,
): Promise<OfficeExpansionReviewAuditEntry[]> {
  const rows = await prisma.auditLog.findMany({
    where: {
      entityType: OFFICE_EXPANSION_REVIEW_AUDIT_ENTITY_TYPE,
      entityId: OFFICE_EXPANSION_REVIEW_ENTITY_ID,
      action: { in: Object.values(OFFICE_EXPANSION_REVIEW_ACTIONS) },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      action: true,
      createdAt: true,
      actorId: true,
      message: true,
    },
  });

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    occurredAt: row.createdAt.toISOString(),
    actorId: row.actorId,
    message: row.message,
  }));
}

export async function recordOfficeExpansionReviewDecision(input: {
  decision: OfficeExpansionReviewDecision;
  actorId: string;
  actorDisplayName: string;
  actorEmail?: string;
  guardReady: boolean;
  note?: string;
  sourceRoute: string;
}): Promise<OfficeExpansionReviewRecord> {
  const action = OFFICE_EXPANSION_REVIEW_ACTIONS[input.decision];
  const message =
    input.note?.trim() ||
    `Office rollout expansion review ${input.decision} by ${input.actorDisplayName}.`;

  await writeAdminAudit({
    organizationId: DEFAULT_ORG_ID,
    actorId: input.actorId,
    action,
    entityType: OFFICE_EXPANSION_REVIEW_AUDIT_ENTITY_TYPE,
    entityId: OFFICE_EXPANSION_REVIEW_ENTITY_ID,
    sourceModule: "work-orders",
    sourceRoute: input.sourceRoute,
    httpMethod: "POST",
    outcome: input.decision === "approve" ? "SUCCESS" : "NEUTRAL",
    category: "CHANGE_MANAGEMENT",
    severity: "MEDIUM",
    message,
    payload: {
      decision: input.decision,
      actorDisplayName: input.actorDisplayName,
      actorEmail: input.actorEmail ?? null,
      guardReady: input.guardReady,
      note: input.note ?? null,
    },
  });

  return getLatestOfficeExpansionReview();
}

export async function getOfficeExpansionReviewSignoffContext() {
  const review = await getLatestOfficeExpansionReview();
  const audits = await listOfficeExpansionReviewAudits();
  const recentRolloutAudits = await listRecentOfficeRolloutSignoffAudits();
  return { review, audits, recentRolloutAudits };
}

export async function listRecentOfficeRolloutSignoffAudits(limit = 8) {
  const actions = [
    ...Object.values(OFFICE_PILOT_SIGNOFF_ACTIONS),
    ...Object.values(OFFICE_DISPATCHER_SIGNOFF_ACTIONS),
    ...Object.values(OFFICE_ROLE_EXPANSION_SIGNOFF_ACTIONS),
    ...Object.values(OFFICE_EXPANSION_REVIEW_ACTIONS),
  ];

  const rows = await prisma.auditLog.findMany({
    where: { action: { in: actions } },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      action: true,
      entityType: true,
      createdAt: true,
      message: true,
    },
  });

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    entityType: row.entityType,
    occurredAt: row.createdAt.toISOString(),
    message: row.message,
  }));
}
