/**
 * Patch 50C-3 — Idempotent master owner access (SUPER_ADMIN).
 *
 * Does not invent SYSTEM_OWNER / MASTER_ADMIN roles. Matrix already uses
 * SUPER_ADMIN as the highest internal administrator role.
 */

import { prisma } from "@/lib/db/prisma";
import { writeAdminAudit } from "@/lib/admin/repository";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import type { MatrixRole } from "@/lib/auth/types";
import { hasMatrixPermission } from "@/lib/auth/permissions";

export const MASTER_ADMIN_ROLE: MatrixRole = "SUPER_ADMIN";

const INTERNAL_ADMIN_ROLES = new Set<MatrixRole>([
  "SUPER_ADMIN",
  "ADMIN",
  "SERVICE_MANAGER",
  "REGIONAL_MANAGER",
  "OPERATIONS_MANAGER",
  "DIRECTOR",
]);

const CUSTOMER_ROLES = new Set<MatrixRole>([
  "CUSTOMER_ADMIN",
  "CUSTOMER_MANAGER",
  "CUSTOMER_USER",
  "CUSTOMER_VIEWER",
]);

export type OwnerIdentification = {
  located: boolean;
  reason: string;
  directoryUserId?: string;
  email?: string;
  name?: string;
  clerkUserId?: string | null;
  currentRole?: MatrixRole;
  organizationId?: string;
};

export type OwnerAccessResult = {
  primaryOwnerLocated: boolean;
  currentRole: string;
  finalRole: string;
  masterAccessVerified: boolean;
  missingPermissionsAdded: string[];
  duplicateAccountCreated: false;
  clerkIdentityPreserved: true;
  message: string;
  directoryUserId?: string;
};

function roleRank(role: MatrixRole): number {
  if (role === "SUPER_ADMIN") return 100;
  if (role === "ADMIN") return 90;
  if (INTERNAL_ADMIN_ROLES.has(role)) return 50;
  return 0;
}

function envOwnerEmail(): string | null {
  const v = process.env.MATRIX_OWNER_EMAIL?.trim().toLowerCase();
  return v || null;
}

function envOwnerClerkId(): string | null {
  const v = process.env.MATRIX_OWNER_CLERK_USER_ID?.trim();
  return v || null;
}

/** Safely locate the primary Matrix owner — never invents an arbitrary user. */
export async function identifyPrimaryOwner(
  organizationId = DEFAULT_ORG_ID,
): Promise<OwnerIdentification> {
  const clerkId = envOwnerClerkId();
  const email = envOwnerEmail();

  if (clerkId) {
    const byClerk = await prisma.adminDirectoryUser.findFirst({
      where: { organizationId, clerkUserId: clerkId },
    });
    if (byClerk) {
      if (CUSTOMER_ROLES.has(byClerk.matrixRole as MatrixRole)) {
        return {
          located: false,
          reason:
            "MATRIX_OWNER_CLERK_USER_ID matches a customer-portal directory role; refusing master assignment.",
        };
      }
      return {
        located: true,
        reason: "Matched MATRIX_OWNER_CLERK_USER_ID",
        directoryUserId: byClerk.id,
        email: byClerk.email,
        name: byClerk.name,
        clerkUserId: byClerk.clerkUserId,
        currentRole: byClerk.matrixRole as MatrixRole,
        organizationId: byClerk.organizationId,
      };
    }
  }

  if (email) {
    const byEmail = await prisma.adminDirectoryUser.findFirst({
      where: { organizationId, email: { equals: email } },
    });
    if (byEmail) {
      if (CUSTOMER_ROLES.has(byEmail.matrixRole as MatrixRole)) {
        return {
          located: false,
          reason:
            "MATRIX_OWNER_EMAIL matches a customer-portal directory role; refusing master assignment.",
        };
      }
      return {
        located: true,
        reason: "Matched MATRIX_OWNER_EMAIL",
        directoryUserId: byEmail.id,
        email: byEmail.email,
        name: byEmail.name,
        clerkUserId: byEmail.clerkUserId,
        currentRole: byEmail.matrixRole as MatrixRole,
        organizationId: byEmail.organizationId,
      };
    }
    return {
      located: false,
      reason: `MATRIX_OWNER_EMAIL=${email} did not match any AdminDirectoryUser in ${organizationId}.`,
    };
  }

  // Safe heuristic: exactly one active SUPER_ADMIN (preferred), else exactly one ADMIN/SUPER_ADMIN.
  const candidates = await prisma.adminDirectoryUser.findMany({
    where: {
      organizationId,
      isActive: true,
      status: { in: ["Active", "ACTIVE"] },
      matrixRole: { in: ["SUPER_ADMIN", "ADMIN"] },
    },
    orderBy: { createdAt: "asc" },
  });

  const internal = candidates.filter(
    (u) => !CUSTOMER_ROLES.has(u.matrixRole as MatrixRole),
  );

  const superOnly = internal.filter((u) => u.matrixRole === "SUPER_ADMIN");
  if (superOnly.length === 1) {
    const only = superOnly[0]!;
    return {
      located: true,
      reason:
        "Single active SUPER_ADMIN directory user in organization (safe heuristic).",
      directoryUserId: only.id,
      email: only.email,
      name: only.name,
      clerkUserId: only.clerkUserId,
      currentRole: only.matrixRole as MatrixRole,
      organizationId: only.organizationId,
    };
  }

  if (internal.length === 1) {
    const only = internal[0]!;
    return {
      located: true,
      reason:
        "Single active SUPER_ADMIN/ADMIN directory user in organization (safe heuristic).",
      directoryUserId: only.id,
      email: only.email,
      name: only.name,
      clerkUserId: only.clerkUserId,
      currentRole: only.matrixRole as MatrixRole,
      organizationId: only.organizationId,
    };
  }

  if (internal.length === 0) {
    return {
      located: false,
      reason:
        "No owner configured (set MATRIX_OWNER_EMAIL or MATRIX_OWNER_CLERK_USER_ID) and no single active ADMIN/SUPER_ADMIN directory user found.",
    };
  }

  return {
    located: false,
    reason: `Ambiguous owner: ${internal.length} active ADMIN/SUPER_ADMIN directory users (${superOnly.length} SUPER_ADMIN). Set MATRIX_OWNER_EMAIL or MATRIX_OWNER_CLERK_USER_ID.`,
  };
}

/**
 * Idempotent: promote identified owner to SUPER_ADMIN when appropriate.
 * Never downgrades, never duplicates users, never overwrites Clerk identity.
 */
export async function ensureMasterOwnerAccess(
  organizationId = DEFAULT_ORG_ID,
  actorUserId = "system-owner-migration",
): Promise<OwnerAccessResult> {
  const identified = await identifyPrimaryOwner(organizationId);

  if (!identified.located || !identified.directoryUserId || !identified.currentRole) {
    await writeAdminAudit({
      organizationId,
      actorId: actorUserId,
      action: "MASTER_ADMIN_ACCESS_VERIFIED",
      entityType: "AdminDirectoryUser",
      payload: {
        located: false,
        reason: identified.reason,
      },
      category: "AUTHORIZATION",
      severity: "WARNING",
      outcome: "BLOCKED",
      message: identified.reason,
    });
    return {
      primaryOwnerLocated: false,
      currentRole: "Unknown",
      finalRole: "Unknown",
      masterAccessVerified: false,
      missingPermissionsAdded: [],
      duplicateAccountCreated: false,
      clerkIdentityPreserved: true,
      message: identified.reason,
    };
  }

  const currentRole = identified.currentRole;
  let finalRole = currentRole;
  const missingPermissionsAdded: string[] = [];

  if (CUSTOMER_ROLES.has(currentRole)) {
    return {
      primaryOwnerLocated: true,
      currentRole,
      finalRole: currentRole,
      masterAccessVerified: false,
      missingPermissionsAdded: [],
      duplicateAccountCreated: false,
      clerkIdentityPreserved: true,
      directoryUserId: identified.directoryUserId,
      message: "Refusing to assign master role to a customer portal user.",
    };
  }

  if (roleRank(currentRole) < roleRank(MASTER_ADMIN_ROLE)) {
    await prisma.adminDirectoryUser.update({
      where: { id: identified.directoryUserId },
      data: {
        matrixRole: MASTER_ADMIN_ROLE,
        updatedAtVersion: { increment: 1 },
      },
    });
    finalRole = MASTER_ADMIN_ROLE;
    missingPermissionsAdded.push(
      `Promoted directory role ${currentRole} → ${MASTER_ADMIN_ROLE}`,
    );
    await writeAdminAudit({
      organizationId,
      actorId: actorUserId,
      action: "MASTER_ADMIN_ROLE_ASSIGNED",
      entityType: "AdminDirectoryUser",
      entityId: identified.directoryUserId,
      payload: {
        previousRole: currentRole,
        newRole: MASTER_ADMIN_ROLE,
        email: identified.email,
        reason: identified.reason,
      },
      category: "AUTHORIZATION",
      severity: "NOTICE",
      outcome: "SUCCESS",
      message: `Assigned ${MASTER_ADMIN_ROLE} to owner directory user`,
    });
  }

  // Optionally link Clerk id without overwriting an existing different id.
  const envClerk = envOwnerClerkId();
  if (envClerk && !identified.clerkUserId) {
    await prisma.adminDirectoryUser.update({
      where: { id: identified.directoryUserId },
      data: { clerkUserId: envClerk },
    });
  }

  const masterOk =
    finalRole === MASTER_ADMIN_ROLE &&
    hasMatrixPermission(finalRole, "VIEW_ADMINISTRATION") &&
    hasMatrixPermission(finalRole, "MANAGE_USERS") &&
    hasMatrixPermission(finalRole, "VIEW_SYSTEM_LOGS") &&
    hasMatrixPermission(finalRole, "VIEW_ROLE_SIMULATOR") &&
    hasMatrixPermission(finalRole, "VIEW_ARCHIVED_RECORDS") &&
    hasMatrixPermission(finalRole, "DELETE_ADMIN_RECORD_PERMANENTLY");

  await writeAdminAudit({
    organizationId,
    actorId: actorUserId,
    action: "MASTER_ADMIN_ACCESS_VERIFIED",
    entityType: "AdminDirectoryUser",
    entityId: identified.directoryUserId,
    payload: {
      located: true,
      email: identified.email,
      currentRole,
      finalRole,
      masterOk,
      identification: identified.reason,
    },
    category: "AUTHORIZATION",
    severity: "INFO",
    outcome: masterOk ? "SUCCESS" : "PARTIAL",
    message: masterOk
      ? "Master administration verified for primary owner"
      : "Owner located but master verification incomplete",
  });

  return {
    primaryOwnerLocated: true,
    currentRole,
    finalRole,
    masterAccessVerified: masterOk,
    missingPermissionsAdded,
    duplicateAccountCreated: false,
    clerkIdentityPreserved: true,
    directoryUserId: identified.directoryUserId,
    message: masterOk
      ? "Primary owner has SUPER_ADMIN master access."
      : "Owner located; role assignment incomplete.",
  };
}
