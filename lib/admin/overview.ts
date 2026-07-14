import { prisma } from "@/lib/db/prisma";
import { isClerkConfigured } from "@/lib/auth/clerk-config";
import { getMatrixAssistPublicStatus } from "@/lib/matrix-assist/config";
import { ADMIN_ROLES, DEFAULT_ORG_ID } from "./types";
import { ensureAdminFoundationSeeded } from "./repository";

export async function getAdminOverview(organizationId = DEFAULT_ORG_ID) {
  await ensureAdminFoundationSeeded(organizationId);

  const [
    activeUsers,
    inactiveUsers,
    invitedUsers,
    adminUsers,
    managers,
    directors,
    recentAudit,
    regionsWithoutUsers,
    features,
    profile,
  ] = await Promise.all([
    prisma.adminDirectoryUser.count({
      where: { organizationId, isActive: true },
    }),
    prisma.adminDirectoryUser.count({
      where: { organizationId, isActive: false },
    }),
    prisma.adminDirectoryUser.count({
      where: { organizationId, status: "Invited" },
    }),
    prisma.adminDirectoryUser.count({
      where: {
        organizationId,
        isActive: true,
        matrixRole: { in: ADMIN_ROLES },
      },
    }),
    prisma.adminDirectoryUser.count({
      where: {
        organizationId,
        isActive: true,
        matrixRole: {
          in: ["SERVICE_MANAGER", "REGIONAL_MANAGER", "OPERATIONS_MANAGER"],
        },
      },
    }),
    prisma.adminDirectoryUser.count({
      where: { organizationId, isActive: true, matrixRole: "DIRECTOR" },
    }),
    prisma.auditLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.adminRegion.findMany({ where: { organizationId, active: true } }),
    prisma.adminFeatureControl.findMany({ where: { organizationId } }),
    prisma.adminOrganizationProfile.findUnique({ where: { organizationId } }),
  ]);

  const roleChanges = recentAudit.filter((a) =>
    a.action.includes("ROLE"),
  ).length;

  const configAlerts: string[] = [];
  if (!profile?.displayName) configAlerts.push("Organization profile incomplete");
  if (!profile?.defaultRegionId) configAlerts.push("Default region missing");
  if (!profile?.defaultWarehouseId) configAlerts.push("Default warehouse missing");
  const assist = getMatrixAssistPublicStatus();
  if (!assist.configured && assist.enabled) {
    configAlerts.push("Matrix Assist not configured");
  }
  if (!isClerkConfigured()) {
    configAlerts.push("Authentication provider not fully configured");
  }

  const usersWithoutRegion = await prisma.adminDirectoryUser.count({
    where: {
      organizationId,
      isActive: true,
      primaryRegionId: null,
      matrixRole: { notIn: ["SUPER_ADMIN", "ADMIN", "DIRECTOR"] },
    },
  });

  return {
    metrics: {
      activeUsers,
      inactiveUsers,
      pendingInvitations: invitedUsers,
      administrativeUsers: adminUsers,
      managers,
      directors,
      recentRoleChanges: roleChanges,
      recentAdminActivity: recentAudit.length,
      configurationAlerts: configAlerts.length,
      securityAlerts: adminUsers <= 1 ? 1 : 0,
    },
    recentActivity: recentAudit.map((a) => ({
      id: a.id,
      action: a.action,
      entityType: a.entityType,
      entityId: a.entityId,
      createdAt: a.createdAt.toISOString(),
      payload: a.payload,
    })),
    accessReview: {
      elevatedUsers: adminUsers,
      usersWithoutRegion,
      inactiveUsers,
      pendingInvitations: invitedUsers,
      administratorsRequiringReview: adminUsers <= 1,
    },
    configurationStatus: configAlerts,
    regions: regionsWithoutUsers,
    features,
    profile,
    clerkConfigured: isClerkConfigured(),
  };
}

export async function getSecuritySummary(organizationId = DEFAULT_ORG_ID) {
  await ensureAdminFoundationSeeded(organizationId);
  const [
    admins,
    superAdmins,
    roleManagers,
    deactivated,
    invited,
    recentAccess,
  ] = await Promise.all([
    prisma.adminDirectoryUser.findMany({
      where: { organizationId, isActive: true, matrixRole: "ADMIN" },
    }),
    prisma.adminDirectoryUser.findMany({
      where: { organizationId, isActive: true, matrixRole: "SUPER_ADMIN" },
    }),
    prisma.adminDirectoryUser.findMany({
      where: {
        organizationId,
        isActive: true,
        matrixRole: { in: ["ADMIN", "SUPER_ADMIN"] },
      },
    }),
    prisma.adminDirectoryUser.count({
      where: { organizationId, isActive: false },
    }),
    prisma.adminDirectoryUser.count({
      where: { organizationId, status: "Invited" },
    }),
    prisma.auditLog.findMany({
      where: {
        organizationId,
        action: {
          in: [
            "USER_ACCESS_DEACTIVATED",
            "USER_ACCESS_REACTIVATED",
            "USER_ROLE_CHANGED",
          ],
        },
      },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
  ]);

  const warnings: string[] = [];
  if (admins.length + superAdmins.length <= 1) {
    warnings.push("Only one active administrator remains.");
  }
  if (deactivated > 0) {
    warnings.push(`${deactivated} deactivated user(s) remain in administrative history.`);
  }

  return {
    activeAdministrators: admins.length,
    activeSuperAdministrators: superAdmins.length,
    usersWithRoleManagement: roleManagers.length,
    deactivatedUsers: deactivated,
    pendingInvitations: invited,
    recentAccessChanges: recentAccess.map((a) => ({
      id: a.id,
      action: a.action,
      entityId: a.entityId,
      createdAt: a.createdAt.toISOString(),
    })),
    organizationIsolation: "Enforced by organization-scoped administration queries.",
    authenticationProvider: isClerkConfigured()
      ? "Clerk: Configured"
      : "Clerk: Not Configured",
    warnings,
  };
}
