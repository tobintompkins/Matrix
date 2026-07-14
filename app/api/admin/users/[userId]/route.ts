import { NextResponse } from "next/server";
import type { MatrixRole } from "@/lib/auth/types";
import {
  canManageUsersInScope,
  forbidUnless,
  resolveAdminActor,
} from "@/lib/admin/auth";
import { ELEVATED_ROLES } from "@/lib/admin/types";
import {
  deactivateUser,
  getAdminUser,
  reactivateUser,
  updateUserRole,
} from "@/lib/admin/repository";
import { getDefaultPermissionsForRole } from "@/lib/auth/permissions";
import { getRoleDisplayName } from "@/lib/admin/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ userId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "MANAGE_USERS");
  if (denied) return denied;

  const { userId } = await params;
  const user = await getAdminUser(userId);
  if (!user || !canManageUsersInScope(actor, user)) {
    return NextResponse.json({ ok: false, error: "User not found." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    user: {
      ...user,
      roleDisplayName: getRoleDisplayName(user.matrixRole as MatrixRole),
      permissions: getDefaultPermissionsForRole(user.matrixRole as MatrixRole),
      displayStatus: user.isActive ? user.status : "Deactivated User",
    },
  });
}

export async function PATCH(request: Request, { params }: Params) {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "MANAGE_USERS");
  if (denied) return denied;

  const { userId } = await params;
  const user = await getAdminUser(userId);
  if (!user || !canManageUsersInScope(actor, user)) {
    return NextResponse.json({ ok: false, error: "User not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    action?: "change_role" | "deactivate" | "reactivate";
    newRole?: MatrixRole;
    reason?: string;
    expectedVersion?: number;
  };

  const expectedVersion = body.expectedVersion ?? user.updatedAtVersion;

  if (body.action === "change_role") {
    if (!body.newRole) {
      return NextResponse.json({ ok: false, error: "newRole is required." }, { status: 400 });
    }
    if (ELEVATED_ROLES.includes(body.newRole) && !(body.reason ?? "").trim()) {
      return NextResponse.json(
        { ok: false, error: "A reason is required when granting elevated roles." },
        { status: 400 },
      );
    }
    const result = await updateUserRole({
      userId,
      newRole: body.newRole,
      actorId: actor.userId,
      organizationId: actor.organizationId,
      reason: body.reason,
      expectedVersion,
    });
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 409 });
    }
    return NextResponse.json({ ok: true, user: result.user });
  }

  if (body.action === "deactivate") {
    const deactDenied = forbidUnless(actor, "DEACTIVATE_USERS");
    if (deactDenied) return deactDenied;
    if (!(body.reason ?? "").trim()) {
      return NextResponse.json(
        { ok: false, error: "A deactivation reason is required." },
        { status: 400 },
      );
    }
    const result = await deactivateUser({
      userId,
      actorId: actor.userId,
      organizationId: actor.organizationId,
      reason: body.reason!,
      expectedVersion,
    });
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 409 });
    }
    return NextResponse.json({ ok: true, user: result.user });
  }

  if (body.action === "reactivate") {
    const result = await reactivateUser({
      userId,
      actorId: actor.userId,
      organizationId: actor.organizationId,
      expectedVersion,
    });
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 409 });
    }
    return NextResponse.json({ ok: true, user: result.user });
  }

  return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
}
