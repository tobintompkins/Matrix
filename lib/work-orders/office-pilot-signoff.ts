import { writeAdminAudit } from "@/lib/admin/repository";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import { prisma } from "@/lib/db/prisma";
import {
  OFFICE_PILOT_AUDIT_ENTITY_TYPE,
  OFFICE_PILOT_SIGNOFF_ACTIONS,
  getConfiguredOfficePilotManager,
  officePilotEntityId,
  resolvePilotSignoffStatus,
  type OfficePilotSignoffDecision,
  type OfficePilotSignoffStatus,
} from "./office-pilot";

export type OfficePilotSignoffRecord = {
  status: OfficePilotSignoffStatus;
  action: string | null;
  occurredAt: string | null;
  actorId: string | null;
  actorDisplayName: string | null;
  message: string | null;
};

export type OfficePilotSignoffAuditEntry = {
  id: string;
  action: string;
  occurredAt: string;
  actorId: string | null;
  message: string | null;
  payload: Record<string, unknown> | null;
};

export async function getLatestOfficePilotSignoff(
  configuredPilotManager: string,
): Promise<OfficePilotSignoffRecord> {
  const entityId = officePilotEntityId(configuredPilotManager);
  const row = await prisma.auditLog.findFirst({
    where: {
      entityType: OFFICE_PILOT_AUDIT_ENTITY_TYPE,
      entityId,
      action: { in: Object.values(OFFICE_PILOT_SIGNOFF_ACTIONS) },
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
    status: resolvePilotSignoffStatus(row.action),
    action: row.action,
    occurredAt: row.createdAt.toISOString(),
    actorId: row.actorId,
    actorDisplayName,
    message: row.message,
  };
}

export async function listOfficePilotSignoffAudits(
  configuredPilotManager: string,
  limit = 10,
): Promise<OfficePilotSignoffAuditEntry[]> {
  const entityId = officePilotEntityId(configuredPilotManager);
  const rows = await prisma.auditLog.findMany({
    where: {
      entityType: OFFICE_PILOT_AUDIT_ENTITY_TYPE,
      entityId,
      action: { in: Object.values(OFFICE_PILOT_SIGNOFF_ACTIONS) },
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

export async function recordOfficePilotSignoffDecision(input: {
  decision: OfficePilotSignoffDecision;
  actorId: string;
  actorDisplayName: string;
  actorEmail?: string;
  pilotManager: string;
  guardReady: boolean;
  note?: string;
  sourceRoute: string;
}): Promise<OfficePilotSignoffRecord> {
  const action = OFFICE_PILOT_SIGNOFF_ACTIONS[input.decision];
  const message =
    input.note?.trim() ||
    `Office server queue pilot ${input.decision} by ${input.actorDisplayName}.`;

  await writeAdminAudit({
    organizationId: DEFAULT_ORG_ID,
    actorId: input.actorId,
    action,
    entityType: OFFICE_PILOT_AUDIT_ENTITY_TYPE,
    entityId: officePilotEntityId(input.pilotManager),
    sourceModule: "work-orders",
    sourceRoute: input.sourceRoute,
    httpMethod: "POST",
    outcome: input.decision === "approve" ? "SUCCESS" : "NEUTRAL",
    category: "CHANGE_MANAGEMENT",
    severity: "MEDIUM",
    message,
    payload: {
      decision: input.decision,
      pilotManager: input.pilotManager,
      actorDisplayName: input.actorDisplayName,
      actorEmail: input.actorEmail ?? null,
      guardReady: input.guardReady,
      note: input.note ?? null,
    },
  });

  return getLatestOfficePilotSignoff(input.pilotManager);
}

export async function getOfficePilotSignoffContext(configuredPilotManager?: string | null) {
  const pilotManager = configuredPilotManager ?? getConfiguredOfficePilotManager();
  if (!pilotManager) {
    return {
      pilotManager: null,
      signoff: {
        status: "none" as const,
        action: null,
        occurredAt: null,
        actorId: null,
        actorDisplayName: null,
        message: null,
      },
      audits: [] as OfficePilotSignoffAuditEntry[],
    };
  }
  const [signoff, audits] = await Promise.all([
    getLatestOfficePilotSignoff(pilotManager),
    listOfficePilotSignoffAudits(pilotManager),
  ]);
  return { pilotManager, signoff, audits };
}
