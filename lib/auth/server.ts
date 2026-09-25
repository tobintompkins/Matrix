import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  getDefaultPermissionsForRole,
  hasMatrixPermission,
  resolveMatrixRole,
} from "./permissions";
import type { MatrixPermission, MatrixUserProfile } from "./types";

/**
 * Require a signed-in Clerk user for API / server handlers.
 * Returns the auth payload or a 401 NextResponse.
 */
export async function requireMatrixAuth(): Promise<
  | {
      ok: true;
      userId: string;
      profile: MatrixUserProfile;
    }
  | { ok: false; response: NextResponse }
> {
  const session = await auth();
  if (!session.userId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const user = await currentUser();
  const publicMetadata = (user?.publicMetadata ?? {}) as Record<
    string,
    unknown
  >;
  const { role, usingDevFallbackRole } = resolveMatrixRole(publicMetadata);

  // Future Clerk publicMetadata: matrixRole, assignedRegion, assignedTruckId,
  // assignedWarehouseId, organizationId, technicianId
  const profile: MatrixUserProfile = {
    userId: session.userId,
    email: user?.primaryEmailAddress?.emailAddress,
    displayName:
      user?.fullName ??
      user?.username ??
      user?.primaryEmailAddress?.emailAddress ??
      "Matrix User",
    role,
    organizationId:
      typeof publicMetadata.organizationId === "string"
        ? publicMetadata.organizationId
        : undefined,
    assignedRegion:
      typeof publicMetadata.assignedRegion === "string"
        ? publicMetadata.assignedRegion
        : undefined,
    assignedTruckId:
      typeof publicMetadata.assignedTruckId === "string"
        ? publicMetadata.assignedTruckId
        : undefined,
    assignedWarehouseId:
      typeof publicMetadata.assignedWarehouseId === "string"
        ? publicMetadata.assignedWarehouseId
        : undefined,
    technicianId:
      typeof publicMetadata.technicianId === "string"
        ? publicMetadata.technicianId
        : undefined,
    technicianName:
      typeof publicMetadata.technicianName === "string"
        ? publicMetadata.technicianName
        : undefined,
    usingDevFallbackRole,
  };

  return { ok: true, userId: session.userId, profile };
}

/**
 * Require a signed-in user with a specific Matrix permission.
 */
export async function requireMatrixPermission(
  permission: MatrixPermission,
): Promise<
  | {
      ok: true;
      userId: string;
      profile: MatrixUserProfile;
    }
  | { ok: false; response: NextResponse }
> {
  const authResult = await requireMatrixAuth();
  if (!authResult.ok) return authResult;

  if (!hasMatrixPermission(authResult.profile.role, permission)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Forbidden", permission },
        { status: 403 },
      ),
    };
  }

  return authResult;
}

/** Require at least one of the listed Matrix permissions. */
export async function requireMatrixPermissionAny(
  permissions: MatrixPermission[],
): Promise<
  | {
      ok: true;
      userId: string;
      profile: MatrixUserProfile;
    }
  | { ok: false; response: NextResponse }
> {
  const authResult = await requireMatrixAuth();
  if (!authResult.ok) return authResult;

  const allowed = permissions.some((permission) =>
    hasMatrixPermission(authResult.profile.role, permission),
  );
  if (!allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Forbidden", permissions },
        { status: 403 },
      ),
    };
  }

  return authResult;
}

export function getPermissionsForProfile(profile: MatrixUserProfile) {
  return getDefaultPermissionsForRole(profile.role);
}
