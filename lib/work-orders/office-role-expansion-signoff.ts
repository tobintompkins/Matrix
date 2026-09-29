import { writeAdminAudit } from "@/lib/admin/repository";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import { prisma } from "@/lib/db/prisma";
import {
  OFFICE_ROLE_EXPANSION_AUDIT_ENTITY_TYPE,
  OFFICE_ROLE_EXPANSION_ENTITY_ID,
  OFFICE_ROLE_EXPANSION_SIGNOFF_ACTIONS,
  getOfficeRoleAllowlist,
  resolveRoleExpansionSignoffStatus,
  type OfficeRoleExpansionSignoffDecision,
} from "./office-role-expansion";
import type { OfficePilotSignoffStatus } from "./office-pilot";

export type OfficeRoleExpansionSignoffRecord = {
  status: OfficePilotSignoffStatus;
  action: string | null;
  occurredAt: string | null;
  actorId: string | null;
  actorDisplayName: string | null;
  message: string | null;
};

export type OfficeRoleExpansionSignoffAuditEntry = {
  id: string;
  action: string;
  occurredAt: string;
  actorId: string | null;
  message: string | null;
  payload: Record<string, unknown> | null;
};

export async function getLatestOfficeRoleExpansionSignoff(): Promise<OfficeRoleExpansionSignoffRecord> {
  const row = await prisma.auditLog.findFirst({
    where: {
      entityType: OFFICE_ROLE_EXPANSION_AUDIT_ENTITY_TYPE,
      entityId: OFFICE_ROLE_EXPANSION_ENTITY_ID,
      action: { in: Object.values(OFFICE_ROLE_EXPANSION_SIGNOFF_ACTIONS) },
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
    status: resolveRoleExpansionSignoffStatus(row.action),
    action: row.action,
    occurredAt: row.createdAt.toISOString(),
    actorId: row.actorId,
    actorDisplayName,
    message: row.message,
  };
}

export async function listOfficeRoleExpansionSignoffAudits(
  limit = 10,
): Promise<OfficeRoleExpansionSignoffAuditEntry[]> {
  const rows = await prisma.auditLog.findMany({
    where: {
      entityType: OFFICE_ROLE_EXPANSION_AUDIT_ENTITY_TYPE,
      entityId: OFFICE_ROLE_EXPANSION_ENTITY_ID,
      action: { in: Object.values(OFFICE_ROLE_EXPANSION_SIGNOFF_ACTIONS) },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      action: true,
      createdAt: true,
      actorId: true,
      message: true,
      payload: true,
    },
  });

  return rows.map((row) => {
    let payload: Record<string, unknown> | null = null;
    if (row.payload) {
      try {
        payload = JSON.parse(row.payload) as Record<string, unknown>;
      } catch {
        payload = null;
      }
    }
    return {
      id: row.id,
      action: row.action,
      occurredAt: row.createdAt.toISOString(),
      actorId: row.actorId,
      message: row.message,
      payload,
    };
  });
}

export async function recordOfficeRoleExpansionSignoffDecision(input: {
  decision: OfficeRoleExpansionSignoffDecision;
  actorId: string;
  actorDisplayName: string;
  actorEmail?: string;
  guardReady: boolean;
  pilotSignoffApproved: boolean;
  dispatcherSignoffApproved: boolean;
  note?: string;
  sourceRoute: string;
}): Promise<OfficeRoleExpansionSignoffRecord> {
  const allowlist = getOfficeRoleAllowlist();
  const action = OFFICE_ROLE_EXPANSION_SIGNOFF_ACTIONS[input.decision];
  const message =
    input.note?.trim() ||
    `Office role expansion ${input.decision} by ${input.actorDisplayName}.`;

  await writeAdminAudit({
    organizationId: DEFAULT_ORG_ID,
    actorId: input.actorId,
    action,
    entityType: OFFICE_ROLE_EXPANSION_AUDIT_ENTITY_TYPE,
    entityId: OFFICE_ROLE_EXPANSION_ENTITY_ID,
    sourceModule: "work-orders",
    sourceRoute: input.sourceRoute,
    httpMethod: "POST",
    outcome: input.decision === "approve" ? "SUCCESS" : "NEUTRAL",
    category: "CHANGE_MANAGEMENT",
    severity: "MEDIUM",
    message,
    payload: {
      decision: input.decision,
      roleAllowlist: allowlist,
      actorDisplayName: input.actorDisplayName,
      actorEmail: input.actorEmail ?? null,
      guardReady: input.guardReady,
      pilotSignoffApproved: input.pilotSignoffApproved,
      dispatcherSignoffApproved: input.dispatcherSignoffApproved,
      note: input.note ?? null,
    },
  });

  return getLatestOfficeRoleExpansionSignoff();
}

export async function getOfficeRoleExpansionSignoffContext() {
  const [signoff, audits] = await Promise.all([
    getLatestOfficeRoleExpansionSignoff(),
    listOfficeRoleExpansionSignoffAudits(),
  ]);
  return {
    allowlist: getOfficeRoleAllowlist(),
    signoff,
    audits,
  };
}
