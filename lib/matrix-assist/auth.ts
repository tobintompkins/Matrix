/**
 * Soft Matrix Assist API actor (mirrors PM API auth pattern).
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { hasMatrixPermission, resolveMatrixRole } from "@/lib/auth/permissions";
import type { MatrixPermission, MatrixRole } from "@/lib/auth/types";
import { DEV_FALLBACK_ROLE } from "@/lib/auth/types";

export type MatrixAssistActor = {
  role: MatrixRole;
  displayName: string;
  userId: string;
  organizationId: string | null;
  authenticated: boolean;
  canUseAssist: boolean;
  canViewTeamSessions: boolean;
  canManageSettings: boolean;
  canViewInventory: boolean;
  canViewAllServiceCalls: boolean;
};

export async function resolveMatrixAssistActor(): Promise<MatrixAssistActor> {
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
          : null;
      return buildActor(role, displayName, session.userId, organizationId, true);
    }
  } catch {
    // fall through
  }
  return buildActor(DEV_FALLBACK_ROLE, "Matrix User", "dev-user", null, false);
}

function buildActor(
  role: MatrixRole,
  displayName: string,
  userId: string,
  organizationId: string | null,
  authenticated: boolean,
): MatrixAssistActor {
  return {
    role,
    displayName,
    userId,
    organizationId,
    authenticated,
    canUseAssist: hasMatrixPermission(role, "USE_MATRIX_ASSIST"),
    canViewTeamSessions: hasMatrixPermission(
      role,
      "VIEW_TEAM_DIAGNOSTIC_SESSIONS",
    ),
    canManageSettings: hasMatrixPermission(
      role,
      "MANAGE_MATRIX_ASSIST_SETTINGS",
    ),
    canViewInventory: hasMatrixPermission(role, "VIEW_INVENTORY"),
    canViewAllServiceCalls:
      hasMatrixPermission(role, "VIEW_FIELD_ALL_TECHNICIANS") ||
      hasMatrixPermission(role, "MANAGE_SERVICE_CALLS") ||
      role === "SERVICE_MANAGER" ||
      role === "ADMIN" ||
      role === "SUPER_ADMIN",
  };
}

export function forbidUnless(
  actor: MatrixAssistActor,
  permission: MatrixPermission,
): NextResponse | null {
  if (hasMatrixPermission(actor.role, permission)) return null;
  return NextResponse.json(
    {
      ok: false,
      error: "You do not have permission to use Matrix Assist for this record.",
      permission,
    },
    { status: 403 },
  );
}
