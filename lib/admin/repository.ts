import { prisma } from "@/lib/db/prisma";
import type { MatrixRole } from "@/lib/auth/types";
import { getDefaultPermissionsForRole } from "@/lib/auth/permissions";
import {
  ADMIN_ROLES,
  DEFAULT_ORG_ID,
  type AdminAccessScope,
  type AdminUserStatus,
} from "./types";
import {
  classifyAction,
  detectEnvironment,
  newCorrelationId,
  newRequestId,
} from "@/lib/system-logs/taxonomy";

const SEED_USERS: Array<{
  email: string;
  name: string;
  matrixRole: MatrixRole;
  status: AdminUserStatus;
  primaryRegionId?: string;
  managerId?: string;
  accessScope: AdminAccessScope;
  isActive: boolean;
}> = [
  {
    email: "admin@sfx.example",
    name: "SFX Administrator",
    matrixRole: "ADMIN",
    status: "Active",
    accessScope: "ORGANIZATION",
    isActive: true,
  },
  {
    email: "super@sfx.example",
    name: "Matrix Super Admin",
    matrixRole: "SUPER_ADMIN",
    status: "Active",
    accessScope: "ORGANIZATION",
    isActive: true,
  },
  {
    email: "manager@sfx.example",
    name: "Jordan Blake",
    matrixRole: "SERVICE_MANAGER",
    status: "Active",
    primaryRegionId: "region-northeast",
    accessScope: "ORGANIZATION",
    isActive: true,
  },
  {
    email: "regional@sfx.example",
    name: "Casey Nguyen",
    matrixRole: "REGIONAL_MANAGER",
    status: "Active",
    primaryRegionId: "region-northeast",
    accessScope: "REGION",
    isActive: true,
  },
  {
    email: "director@sfx.example",
    name: "Morgan Ellis",
    matrixRole: "DIRECTOR",
    status: "Active",
    accessScope: "ORGANIZATION",
    isActive: true,
  },
  {
    email: "alex.rivera@sfx.example",
    name: "Alex Rivera",
    matrixRole: "FIELD_TECHNICIAN",
    status: "Active",
    primaryRegionId: "region-northeast",
    accessScope: "ASSIGNED_WORK",
    isActive: true,
  },
  {
    email: "sam.patel@sfx.example",
    name: "Sam Patel",
    matrixRole: "FIELD_TECHNICIAN",
    status: "Active",
    primaryRegionId: "region-south",
    accessScope: "ASSIGNED_WORK",
    isActive: true,
  },
  {
    email: "former.tech@sfx.example",
    name: "Former Technician",
    matrixRole: "FIELD_TECHNICIAN",
    status: "Deactivated",
    primaryRegionId: "region-northeast",
    accessScope: "ASSIGNED_WORK",
    isActive: false,
  },
  {
    email: "invite.pending@sfx.example",
    name: "Pending Invite",
    matrixRole: "FIELD_TECHNICIAN",
    status: "Invited",
    accessScope: "ASSIGNED_WORK",
    isActive: false,
  },
];

export async function ensureAdminFoundationSeeded(organizationId = DEFAULT_ORG_ID) {
  const regionCount = await prisma.adminRegion.count({
    where: { organizationId },
  });
  if (regionCount === 0) {
    await prisma.adminRegion.createMany({
      data: [
        {
          organizationId,
          key: "region-northeast",
          label: "Northeast",
          description: "Example operating region",
          displayOrder: 1,
        },
        {
          organizationId,
          key: "region-south",
          label: "South",
          description: "Example operating region",
          displayOrder: 2,
        },
        {
          organizationId,
          key: "region-midwest",
          label: "Midwest",
          description: "Example operating region",
          displayOrder: 3,
          active: false,
        },
      ],
    });
  }

  const userCount = await prisma.adminDirectoryUser.count({
    where: { organizationId },
  });
  if (userCount === 0) {
    await prisma.adminDirectoryUser.createMany({
      data: SEED_USERS.map((u) => ({
        organizationId,
        email: u.email,
        name: u.name,
        matrixRole: u.matrixRole,
        status: u.status,
        isActive: u.isActive,
        primaryRegionId: u.primaryRegionId ?? null,
        accessScope: u.accessScope,
        deactivatedAt: u.isActive ? null : new Date(),
        deactivationReason: u.isActive ? null : "Seed deactivated account",
        lastActiveAt: u.isActive ? new Date() : null,
      })),
    });
  }

  const featureCount = await prisma.adminFeatureControl.count({
    where: { organizationId },
  });
  if (featureCount === 0) {
    await prisma.adminFeatureControl.createMany({
      data: [
        {
          organizationId,
          featureKey: "matrix_assist",
          enabled: true,
          description: "Matrix Assist advisory diagnostics",
        },
        {
          organizationId,
          featureKey: "preventive_maintenance",
          enabled: true,
          description: "Preventive Maintenance workflows",
        },
        {
          organizationId,
          featureKey: "inventory",
          enabled: true,
          description: "Parts and inventory modules",
        },
        {
          organizationId,
          featureKey: "reports",
          enabled: true,
          description: "Operational reports",
        },
        {
          organizationId,
          featureKey: "guided_parts_ordering",
          enabled: true,
          description: "Guided diagram parts ordering",
        },
        {
          organizationId,
          featureKey: "notifications",
          enabled: true,
          description: "In-app notifications",
        },
      ],
    });
  }

  const configCount = await prisma.adminConfigurationEntry.count({
    where: { organizationId },
  });
  if (configCount === 0) {
    await prisma.adminConfigurationEntry.createMany({
      data: [
        {
          organizationId,
          configurationType: "service_call_priority",
          key: "LOW",
          label: "Low",
          displayOrder: 1,
          protected: true,
        },
        {
          organizationId,
          configurationType: "service_call_priority",
          key: "NORMAL",
          label: "Normal",
          displayOrder: 2,
          protected: true,
        },
        {
          organizationId,
          configurationType: "service_call_priority",
          key: "HIGH",
          label: "High",
          displayOrder: 3,
          protected: true,
        },
        {
          organizationId,
          configurationType: "service_call_priority",
          key: "URGENT",
          label: "Urgent",
          displayOrder: 4,
          protected: true,
        },
        {
          organizationId,
          configurationType: "machine_status",
          key: "ONLINE",
          label: "Online",
          displayOrder: 1,
          protected: true,
        },
        {
          organizationId,
          configurationType: "machine_status",
          key: "DOWN",
          label: "Down",
          displayOrder: 2,
          protected: true,
        },
        {
          organizationId,
          configurationType: "symptom_category",
          key: "Paper Feed",
          label: "Paper Feed",
          displayOrder: 1,
        },
        {
          organizationId,
          configurationType: "symptom_category",
          key: "Paper Jam",
          label: "Paper Jam",
          displayOrder: 2,
        },
        {
          organizationId,
          configurationType: "symptom_category",
          key: "Print Quality",
          label: "Print Quality",
          displayOrder: 3,
        },
      ],
    });
  }

  const profile = await prisma.adminOrganizationProfile.findUnique({
    where: { organizationId },
  });
  if (!profile) {
    await prisma.adminOrganizationProfile.create({
      data: {
        organizationId,
        legalName: "SFX Service Organization",
        displayName: "SFX",
        supportEmail: "service@sfx.example",
        supportPhone: "+1-555-0100",
        defaultTimeZone: "America/New_York",
        defaultRegionId: "region-northeast",
        defaultWarehouseId: "wh-main",
      },
    });
  }
}

export async function writeAdminAudit(input: {
  organizationId: string;
  actorId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string | null;
  payload?: Record<string, unknown>;
  /** Patch 50C-2 optional taxonomy */
  category?: string;
  severity?: string;
  outcome?: string;
  visibility?: string;
  requestId?: string;
  correlationId?: string;
  sourceModule?: string;
  sourceRoute?: string;
  httpMethod?: string;
  statusCode?: number;
  message?: string;
  errorCode?: string;
  durationMs?: number;
}) {
  const inferred = classifyAction(input.action);

  // AuditLog has FKs to Organization/User. Admin/Clerk IDs often are not present
  // in those tables — ensure org row exists and only link actor when User exists.
  let organizationId: string | null = input.organizationId || null;
  if (organizationId) {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!org) {
      try {
        await prisma.organization.create({
          data: {
            id: organizationId,
            name: organizationId === DEFAULT_ORG_ID ? "SFX" : organizationId,
            slug: organizationId,
          },
        });
      } catch {
        // Concurrent create or schema race — fall back to null if still missing.
        const again = await prisma.organization.findUnique({
          where: { id: organizationId },
          select: { id: true },
        });
        if (!again) organizationId = null;
      }
    }
  }

  let actorId: string | null = input.actorId ?? null;
  if (actorId) {
    const user = await prisma.user.findUnique({
      where: { id: actorId },
      select: { id: true },
    });
    if (!user) {
      // Keep actor identity in payload; do not violate User FK.
      actorId = null;
    }
  }

  const payload: Record<string, unknown> = {
    ...(input.payload ?? {}),
  };
  if (input.actorId && !actorId) {
    payload.actorExternalId = input.actorId;
  }
  if (input.organizationId && !organizationId) {
    payload.organizationExternalId = input.organizationId;
  }

  return prisma.auditLog.create({
    data: {
      organizationId,
      actorId,
      action: input.action,
      entityType: input.entityType ?? "Administration",
      entityId: input.entityId ?? null,
      payload:
        Object.keys(payload).length > 0
          ? JSON.stringify(redactAuditPayload(payload))
          : null,
      category: input.category ?? inferred.category,
      severity: input.severity ?? inferred.severity,
      outcome: input.outcome ?? inferred.outcome,
      visibility: input.visibility ?? inferred.visibility,
      environment: detectEnvironment(),
      requestId: input.requestId ?? newRequestId(),
      correlationId: input.correlationId ?? newCorrelationId(),
      sourceModule: input.sourceModule ?? null,
      sourceRoute: input.sourceRoute ?? null,
      httpMethod: input.httpMethod ?? null,
      statusCode: input.statusCode ?? null,
      message: input.message ?? null,
      errorCode: input.errorCode ?? null,
      durationMs: input.durationMs ?? null,
    },
  });
}

function redactAuditPayload(payload: Record<string, unknown>) {
  const clone = { ...payload };
  for (const key of Object.keys(clone)) {
    if (/password|token|secret|apikey|api_key|cookie|authorization|session/i.test(key)) {
      clone[key] = "[REDACTED]";
    }
  }
  return clone;
}

export async function countActiveAdmins(organizationId: string) {
  return prisma.adminDirectoryUser.count({
    where: {
      organizationId,
      isActive: true,
      matrixRole: { in: ADMIN_ROLES },
    },
  });
}

export async function listAdminUsers(input: {
  organizationId: string;
  regionId?: string | null;
  q?: string;
  role?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  await ensureAdminFoundationSeeded(input.organizationId);
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, input.pageSize ?? 20));
  const where: Record<string, unknown> = {
    organizationId: input.organizationId,
  };
  if (input.regionId) where.primaryRegionId = input.regionId;
  if (input.role) where.matrixRole = input.role;
  if (input.status) where.status = input.status;
  if (input.q?.trim()) {
    const q = input.q.trim();
    where.OR = [
      { name: { contains: q } },
      { email: { contains: q } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.adminDirectoryUser.count({ where }),
    prisma.adminDirectoryUser.findMany({
      where,
      orderBy: [{ name: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return { total, page, pageSize, items };
}

export async function getAdminUser(id: string) {
  return prisma.adminDirectoryUser.findUnique({ where: { id } });
}

export async function updateUserRole(input: {
  userId: string;
  newRole: MatrixRole;
  actorId: string;
  organizationId: string;
  reason?: string;
  expectedVersion: number;
}) {
  const user = await prisma.adminDirectoryUser.findUnique({
    where: { id: input.userId },
  });
  if (!user || user.organizationId !== input.organizationId) {
    return { ok: false as const, error: "User not found." };
  }
  if (user.updatedAtVersion !== input.expectedVersion) {
    return {
      ok: false as const,
      error:
        "This user was updated by another administrator. Refresh the page before trying again.",
    };
  }

  if (
    ADMIN_ROLES.includes(user.matrixRole as MatrixRole) &&
    !ADMIN_ROLES.includes(input.newRole)
  ) {
    const admins = await countActiveAdmins(input.organizationId);
    if (admins <= 1 && user.isActive) {
      return {
        ok: false as const,
        error:
          "This action would leave the organization without an active administrator.",
      };
    }
  }

  const updated = await prisma.adminDirectoryUser.update({
    where: { id: input.userId },
    data: {
      matrixRole: input.newRole,
      updatedAtVersion: { increment: 1 },
    },
  });

  await writeAdminAudit({
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: "USER_ROLE_CHANGED",
    entityId: input.userId,
    payload: {
      previousRole: user.matrixRole,
      newRole: input.newRole,
      reason: input.reason ?? null,
      permissionsAdded: getDefaultPermissionsForRole(input.newRole).filter(
        (p) => !getDefaultPermissionsForRole(user.matrixRole as MatrixRole).includes(p),
      ),
      permissionsRemoved: getDefaultPermissionsForRole(
        user.matrixRole as MatrixRole,
      ).filter((p) => !getDefaultPermissionsForRole(input.newRole).includes(p)),
    },
  });

  return { ok: true as const, user: updated };
}

export async function deactivateUser(input: {
  userId: string;
  actorId: string;
  organizationId: string;
  reason: string;
  expectedVersion: number;
}) {
  const user = await prisma.adminDirectoryUser.findUnique({
    where: { id: input.userId },
  });
  if (!user || user.organizationId !== input.organizationId) {
    return { ok: false as const, error: "User not found." };
  }
  if (!user.isActive) {
    return { ok: false as const, error: "User is already deactivated." };
  }
  if (user.updatedAtVersion !== input.expectedVersion) {
    return {
      ok: false as const,
      error:
        "This user was updated by another administrator. Refresh the page before trying again.",
    };
  }
  if (ADMIN_ROLES.includes(user.matrixRole as MatrixRole)) {
    const admins = await countActiveAdmins(input.organizationId);
    if (admins <= 1) {
      return {
        ok: false as const,
        error:
          "This action would leave the organization without an active administrator.",
      };
    }
  }

  const updated = await prisma.adminDirectoryUser.update({
    where: { id: input.userId },
    data: {
      isActive: false,
      status: "Deactivated",
      deactivatedAt: new Date(),
      deactivatedByUserId: input.actorId,
      deactivationReason: input.reason,
      updatedAtVersion: { increment: 1 },
    },
  });

  await writeAdminAudit({
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: "USER_ACCESS_DEACTIVATED",
    entityId: input.userId,
    payload: { reason: input.reason, previousStatus: user.status },
  });

  return { ok: true as const, user: updated };
}

export async function reactivateUser(input: {
  userId: string;
  actorId: string;
  organizationId: string;
  expectedVersion: number;
}) {
  const user = await prisma.adminDirectoryUser.findUnique({
    where: { id: input.userId },
  });
  if (!user || user.organizationId !== input.organizationId) {
    return { ok: false as const, error: "User not found." };
  }
  if (user.isActive) {
    return { ok: false as const, error: "User is already active." };
  }
  if (user.updatedAtVersion !== input.expectedVersion) {
    return {
      ok: false as const,
      error:
        "This user was updated by another administrator. Refresh the page before trying again.",
    };
  }
  if (!user.matrixRole) {
    return { ok: false as const, error: "User must have a valid role before reactivation." };
  }

  const updated = await prisma.adminDirectoryUser.update({
    where: { id: input.userId },
    data: {
      isActive: true,
      status: "Active",
      deactivatedAt: null,
      deactivatedByUserId: null,
      deactivationReason: null,
      updatedAtVersion: { increment: 1 },
    },
  });

  await writeAdminAudit({
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: "USER_ACCESS_REACTIVATED",
    entityId: input.userId,
  });

  return { ok: true as const, user: updated };
}
