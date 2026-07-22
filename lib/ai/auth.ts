/**
 * Patch 51A.1 — AI Operations Center auth helpers.
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { hasMatrixPermission, resolveMatrixRole } from "@/lib/auth/permissions";
import type { MatrixPermission, MatrixRole } from "@/lib/auth/types";
import { DEV_FALLBACK_ROLE } from "@/lib/auth/types";

export type AiActor = {
  userId: string;
  displayName: string;
  role: MatrixRole;
  authenticated: boolean;
};

export async function resolveAiActor(): Promise<AiActor> {
  try {
    const session = await auth();
    if (session.userId) {
      const user = await currentUser();
      const publicMetadata = (user?.publicMetadata ?? {}) as Record<
        string,
        unknown
      >;
      const { role } = resolveMatrixRole(publicMetadata);
      return {
        userId: session.userId,
        displayName:
          user?.fullName ??
          user?.username ??
          user?.primaryEmailAddress?.emailAddress ??
          "Matrix User",
        role,
        authenticated: true,
      };
    }
  } catch {
    /* fall through */
  }
  return {
    userId: "dev-user",
    displayName: "Matrix User",
    role: DEV_FALLBACK_ROLE,
    authenticated: false,
  };
}

export function forbidUnlessAi(
  actor: AiActor,
  permission: MatrixPermission,
): NextResponse | null {
  if (hasMatrixPermission(actor.role, permission)) return null;
  return NextResponse.json(
    { ok: false, error: "You do not have permission to access the AI Operations Center." },
    { status: 403 },
  );
}
