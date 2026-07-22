/**
 * Patch 51B — Portal actor resolution (Clerk + membership, with safe dev fallback).
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { hasMatrixPermission, resolveMatrixRole } from "@/lib/auth/permissions";
import type { MatrixPermission, MatrixRole } from "@/lib/auth/types";
import { DEV_FALLBACK_ROLE } from "@/lib/auth/types";
import { prisma } from "@/lib/db/prisma";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import type { CustomerMembership, PortalCustomerRole } from "./types";
import { isMembershipActive } from "./access";
import { ensurePortalMembershipsSeeded } from "./prisma-seed";
import { getPortalSettings } from "./config";
import {
  getActiveMembership,
  requireActiveMembership,
} from "./repository";

export type PortalActor = {
  authenticated: boolean;
  userId: string;
  displayName: string;
  email: string | null;
  matrixRole: MatrixRole;
  organizationId: string;
  membership: CustomerMembership | null;
};

function mapPrismaMembership(row: {
  id: string;
  clerkUserId: string;
  email: string | null;
  displayName: string | null;
  customerId: string;
  role: string;
  status: string;
  invitedBy: string | null;
  invitedAt: Date | null;
  acceptedAt: Date | null;
  disabledAt: Date | null;
  lastPortalLogin: Date | null;
  canApproveService: boolean;
  canViewMeters: boolean;
  canViewPm: boolean;
  canDownloadReports: boolean;
  canManageUsers: boolean;
  jobTitle: string | null;
  phone: string | null;
  preferredContactMethod: string | null;
  timeZone: string | null;
  defaultLocationId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): CustomerMembership {
  const rawStatus = row.status.toUpperCase();
  const status: CustomerMembership["status"] =
    rawStatus === "ACTIVE"
      ? "ACTIVE"
      : rawStatus === "INVITED"
        ? "INVITED"
        : rawStatus === "EXPIRED"
          ? "EXPIRED"
          : "DISABLED";

  return {
    id: row.id,
    clerkUserId: row.clerkUserId,
    email: row.email ?? "",
    displayName: row.displayName ?? "Portal User",
    customerId: row.customerId,
    role: row.role as PortalCustomerRole,
    status,
    invitedBy: row.invitedBy ?? "",
    invitedAt: row.invitedAt?.toISOString() ?? row.createdAt.toISOString(),
    acceptedAt: row.acceptedAt?.toISOString() ?? null,
    disabledAt: row.disabledAt?.toISOString() ?? null,
    lastPortalLogin: row.lastPortalLogin?.toISOString() ?? null,
    canApproveService: row.canApproveService,
    canViewMeters: row.canViewMeters,
    canViewPm: row.canViewPm,
    canDownloadReports: row.canDownloadReports,
    canManageUsers: row.canManageUsers,
    jobTitle: row.jobTitle ?? "",
    phone: row.phone ?? "",
    preferredContactMethod:
      (row.preferredContactMethod as CustomerMembership["preferredContactMethod"]) ??
      "EMAIL",
    timeZone: row.timeZone ?? "America/New_York",
    defaultLocationId: row.defaultLocationId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function resolvePortalActor(): Promise<PortalActor> {
  await ensurePortalMembershipsSeeded();

  try {
    const session = await auth();
    if (session.userId) {
      const user = await currentUser();
      const publicMetadata = (user?.publicMetadata ?? {}) as Record<
        string,
        unknown
      >;
      const { role } = resolveMatrixRole(publicMetadata);
      const displayName =
        user?.fullName ??
        user?.username ??
        user?.primaryEmailAddress?.emailAddress ??
        "Portal User";
      const email =
        user?.primaryEmailAddress?.emailAddress ??
        user?.emailAddresses?.[0]?.emailAddress ??
        null;
      const organizationId =
        typeof publicMetadata.organizationId === "string"
          ? publicMetadata.organizationId
          : DEFAULT_ORG_ID;

      let membershipRow = await prisma.customerMembership.findFirst({
        where: {
          clerkUserId: session.userId,
          status: { in: ["ACTIVE", "INVITED"] },
        },
        orderBy: { updatedAt: "desc" },
      });

      // Dev/email fallback: match seeded memberships by email
      if (!membershipRow && email) {
        membershipRow = await prisma.customerMembership.findFirst({
          where: {
            email: { equals: email },
            status: "ACTIVE",
          },
        });
      }

      // Customer Matrix roles without membership row — attach seeded admin for same org demo
      if (
        !membershipRow &&
        (role === "CUSTOMER_ADMIN" ||
          role === "CUSTOMER_MANAGER" ||
          role === "CUSTOMER_USER" ||
          role === "CUSTOMER_VIEWER")
      ) {
        membershipRow = await prisma.customerMembership.findFirst({
          where: { role, status: "ACTIVE" },
          orderBy: { createdAt: "asc" },
        });
      }

      const membership = membershipRow
        ? mapPrismaMembership(membershipRow)
        : null;

      if (membership && membership.status === "ACTIVE") {
        await prisma.customerMembership.update({
          where: { id: membership.id },
          data: { lastPortalLogin: new Date() },
        });
      }

      return {
        authenticated: true,
        userId: session.userId,
        displayName,
        email,
        matrixRole: role,
        organizationId,
        membership,
      };
    }
  } catch {
    /* fall through to development fallback */
  }

  // Development fallback — preserve existing portal session behavior
  const gate = requireActiveMembership();
  const fallbackMembership = gate.ok
    ? gate.membership
    : getActiveMembership();

  return {
    authenticated: false,
    userId: fallbackMembership?.clerkUserId ?? "dev-portal-user",
    displayName: fallbackMembership?.displayName ?? "Portal User",
    email: fallbackMembership?.email ?? null,
    matrixRole: (fallbackMembership?.role as MatrixRole) ?? DEV_FALLBACK_ROLE,
    organizationId: DEFAULT_ORG_ID,
    membership: fallbackMembership,
  };
}

export async function requirePortalAccess(
  permission?: MatrixPermission,
): Promise<
  | { ok: true; actor: PortalActor; membership: CustomerMembership }
  | { ok: false; response: NextResponse }
> {
  const actor = await resolvePortalActor();
  const settings = await getPortalSettings(actor.organizationId);

  if (!settings.portalEnabled) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "Customer Portal is temporarily disabled." },
        { status: 503 },
      ),
    };
  }

  if (!actor.membership) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "Portal access is not configured for this account." },
        { status: 403 },
      ),
    };
  }

  const status = actor.membership.status;
  if (status === "INVITED") {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "Portal invitation is pending activation." },
        { status: 403 },
      ),
    };
  }
  if (!isMembershipActive(actor.membership)) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "Portal access is suspended or revoked." },
        { status: 403 },
      ),
    };
  }

  const canAccess =
    hasMatrixPermission(actor.matrixRole, "VIEW_CUSTOMER_PORTAL") ||
    hasMatrixPermission(actor.matrixRole, "ACCESS_CUSTOMER_PORTAL") ||
    actor.membership.role.startsWith("CUSTOMER_");

  if (!canAccess) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "You do not have permission to access the Customer Portal." },
        { status: 403 },
      ),
    };
  }

  if (
    permission &&
    !hasMatrixPermission(actor.matrixRole, permission) &&
    !hasMatrixPermission(actor.membership.role as MatrixRole, permission)
  ) {
    // Membership capability flags as secondary gate for portal-specific actions
    const allowedByFlag =
      (permission === "SUBMIT_CUSTOMER_METER" &&
        actor.membership.canViewMeters) ||
      (permission === "VIEW_CUSTOMER_PM" && actor.membership.canViewPm) ||
      (permission === "MANAGE_CUSTOMER_PORTAL_USERS" &&
        actor.membership.canManageUsers) ||
      (permission === "CREATE_CUSTOMER_SERVICE_CALL" &&
        actor.membership.role !== "CUSTOMER_VIEWER");

    if (!allowedByFlag) {
      return {
        ok: false,
        response: NextResponse.json(
          { ok: false, error: "Missing portal permission." },
          { status: 403 },
        ),
      };
    }
  }

  return { ok: true, actor, membership: actor.membership };
}

export function portalNotFound() {
  return NextResponse.json(
    { ok: false, error: "Record not available." },
    { status: 404 },
  );
}
