/**
 * Soft PM API actor resolution.
 * Matches app pattern: Clerk when available; DEV_FALLBACK_ROLE for local/unsigned.
 * Still enforces technician data scoping for FIELD_TECHNICIAN roles.
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { hasMatrixPermission, resolveMatrixRole } from "@/lib/auth/permissions";
import type { MatrixPermission, MatrixRole } from "@/lib/auth/types";
import { DEV_FALLBACK_ROLE } from "@/lib/auth/types";

export type PmApiActor = {
  role: MatrixRole;
  displayName: string;
  authenticated: boolean;
  canViewAllTechnicians: boolean;
  canExport: boolean;
  canCorrect: boolean;
  canManageSettings: boolean;
  canComplete: boolean;
};

export async function resolvePmApiActor(): Promise<PmApiActor> {
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
      return buildActor(role, displayName, true);
    }
  } catch {
    // Clerk unavailable — fall through to dev actor
  }
  return buildActor(DEV_FALLBACK_ROLE, "Matrix User", false);
}

function buildActor(
  role: MatrixRole,
  displayName: string,
  authenticated: boolean,
): PmApiActor {
  return {
    role,
    displayName,
    authenticated,
    canViewAllTechnicians: hasMatrixPermission(
      role,
      "VIEW_FIELD_ALL_TECHNICIANS",
    ),
    canExport: hasMatrixPermission(role, "EXPORT_MAINTENANCE"),
    canCorrect: hasMatrixPermission(role, "CORRECT_MAINTENANCE_RECORDS"),
    canManageSettings:
      hasMatrixPermission(role, "MANAGE_PM_SETTINGS") ||
      hasMatrixPermission(role, "EDIT_MAINTENANCE_INTERVALS"),
    canComplete: hasMatrixPermission(role, "COMPLETE_MAINTENANCE"),
  };
}

export function forbidUnless(
  actor: PmApiActor,
  permission: MatrixPermission,
): NextResponse | null {
  if (hasMatrixPermission(actor.role, permission)) return null;
  return NextResponse.json(
    { ok: false, error: "Forbidden", permission },
    { status: 403 },
  );
}

export function resolveScopedTechnician(
  actor: PmApiActor,
  requestedTechnician: string | null | undefined,
): { ok: true; technician: string } | { ok: false; response: NextResponse } {
  const requested = (requestedTechnician ?? "").trim();
  if (actor.canViewAllTechnicians) {
    return { ok: true, technician: requested };
  }
  // Field techs may only view their own dashboard data.
  const self = actor.displayName.trim();
  if (requested && requested.toLowerCase() !== self.toLowerCase()) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error:
            "Forbidden: you may only view your own technician PM dashboard.",
        },
        { status: 403 },
      ),
    };
  }
  return { ok: true, technician: self || requested };
}
