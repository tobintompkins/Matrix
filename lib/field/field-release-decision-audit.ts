import { writeAdminAudit } from "@/lib/admin/repository";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import { prisma } from "@/lib/db/prisma";
import {
  FIELD_RELEASE_DECISION_ACTIONS,
  FIELD_RELEASE_DECISION_AUDIT_ENTITY_TYPE,
  FIELD_RELEASE_DECISION_ENTITY_ID,
  buildFieldReleaseDecisionAuditPayload,
  resolveFieldReleaseDecisionStatus,
  type FieldReleaseDecision,
  type FieldReleaseDecisionAuditEntry,
  type FieldReleaseDecisionRecord,
} from "./field-release-decision";
import type { FieldReleaseReadinessSummary } from "./field-release-readiness";

function parsePayload(raw: string | null): {
  actorDisplayName?: string;
  readinessState?: string;
  verificationSubmissionId?: string;
} {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as ReturnType<typeof parsePayload>;
  } catch {
    return {};
  }
}

function mapDecisionRow(row: {
  id: string;
  action: string;
  createdAt: Date;
  actorId: string | null;
  message: string | null;
  payload: string | null;
}): FieldReleaseDecisionAuditEntry {
  const payload = parsePayload(row.payload);
  return {
    id: row.id,
    action: row.action,
    decision: resolveFieldReleaseDecisionStatus(row.action),
    occurredAt: row.createdAt.toISOString(),
    actorId: row.actorId,
    actorDisplayName: payload.actorDisplayName ?? null,
    message: row.message,
    readinessState: payload.readinessState ?? null,
    verificationSubmissionId: payload.verificationSubmissionId ?? null,
  };
}

export async function getLatestFieldReleaseDecision(): Promise<FieldReleaseDecisionRecord> {
  const row = await prisma.auditLog.findFirst({
    where: {
      entityType: FIELD_RELEASE_DECISION_AUDIT_ENTITY_TYPE,
      entityId: FIELD_RELEASE_DECISION_ENTITY_ID,
      action: { in: Object.values(FIELD_RELEASE_DECISION_ACTIONS) },
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
      readinessState: null,
      verificationSubmissionId: null,
    };
  }

  const payload = parsePayload(row.payload);
  return {
    status: resolveFieldReleaseDecisionStatus(row.action),
    action: row.action,
    occurredAt: row.createdAt.toISOString(),
    actorId: row.actorId,
    actorDisplayName: payload.actorDisplayName ?? null,
    message: row.message,
    readinessState: payload.readinessState ?? null,
    verificationSubmissionId: payload.verificationSubmissionId ?? null,
  };
}

export async function listRecentFieldReleaseDecisions(
  limit = 10,
): Promise<FieldReleaseDecisionAuditEntry[]> {
  const rows = await prisma.auditLog.findMany({
    where: {
      entityType: FIELD_RELEASE_DECISION_AUDIT_ENTITY_TYPE,
      entityId: FIELD_RELEASE_DECISION_ENTITY_ID,
      action: { in: Object.values(FIELD_RELEASE_DECISION_ACTIONS) },
    },
    orderBy: { createdAt: "desc" },
    take: Math.max(1, Math.min(limit, 25)),
    select: {
      id: true,
      action: true,
      createdAt: true,
      actorId: true,
      message: true,
      payload: true,
    },
  });
  return rows.map(mapDecisionRow);
}

export async function recordFieldReleaseDecision(input: {
  decision: FieldReleaseDecision;
  readiness: FieldReleaseReadinessSummary;
  actorId: string;
  actorDisplayName: string;
  actorEmail?: string;
  note?: string;
  sourceRoute: string;
}): Promise<FieldReleaseDecisionRecord> {
  const action = FIELD_RELEASE_DECISION_ACTIONS[input.decision];
  const message =
    input.note?.trim() ||
    `Field release readiness ${input.decision} by ${input.actorDisplayName}.`;

  await writeAdminAudit({
    organizationId: DEFAULT_ORG_ID,
    actorId: input.actorId,
    action,
    entityType: FIELD_RELEASE_DECISION_AUDIT_ENTITY_TYPE,
    entityId: FIELD_RELEASE_DECISION_ENTITY_ID,
    sourceModule: "field",
    sourceRoute: input.sourceRoute,
    httpMethod: "POST",
    outcome: input.decision === "approve" ? "SUCCESS" : "NEUTRAL",
    category: "CHANGE_MANAGEMENT",
    severity: "MEDIUM",
    message,
    payload: buildFieldReleaseDecisionAuditPayload(input),
  });

  return getLatestFieldReleaseDecision();
}
