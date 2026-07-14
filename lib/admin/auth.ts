import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { hasMatrixPermission, resolveMatrixRole } from "@/lib/auth/permissions";
import type { MatrixPermission, MatrixRole } from "@/lib/auth/types";
import { DEV_FALLBACK_ROLE } from "@/lib/auth/types";
import { DEFAULT_ORG_ID } from "./types";

export type AdminActor = {
  role: MatrixRole;
  displayName: string;
  userId: string;
  organizationId: string;
  regionId: string | null;
  authenticated: boolean;
};

export async function resolveAdminActor(): Promise<AdminActor> {
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
        "Matrix User";
      const organizationId =
        typeof publicMetadata.organizationId === "string"
          ? publicMetadata.organizationId
          : DEFAULT_ORG_ID;
      const regionId =
        typeof publicMetadata.assignedRegion === "string"
          ? publicMetadata.assignedRegion
          : null;
      return {
        role,
        displayName,
        userId: session.userId,
        organizationId,
        regionId,
        authenticated: true,
      };
    }
  } catch {
    /* fall through */
  }
  return {
    role: DEV_FALLBACK_ROLE,
    displayName: "Matrix User",
    userId: "dev-user",
    organizationId: DEFAULT_ORG_ID,
    regionId: null,
    authenticated: false,
  };
}

export function forbidUnless(
  actor: AdminActor,
  permission: MatrixPermission,
): NextResponse | null {
  if (hasMatrixPermission(actor.role, permission)) return null;
  return NextResponse.json(
    {
      ok: false,
      error: "You do not have permission to access the Administration Center.",
    },
    { status: 403 },
  );
}

export function canManageUsersInScope(
  actor: AdminActor,
  target: { organizationId: string; primaryRegionId: string | null },
): boolean {
  if (target.organizationId !== actor.organizationId) return false;
  if (
    actor.role === "REGIONAL_MANAGER" &&
    actor.regionId &&
    target.primaryRegionId &&
    target.primaryRegionId !== actor.regionId
  ) {
    return false;
  }
  return hasMatrixPermission(actor.role, "MANAGE_USERS");
}
