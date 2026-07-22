import { NextResponse } from "next/server";
import { requirePortalAccess } from "@/lib/portal/auth";
import {
  getNotificationPrefs,
  updatePortalProfile,
} from "@/lib/portal/enterprise";
import { setActivePortalMembership } from "@/lib/portal/repository";
import { writeAdminAudit } from "@/lib/admin/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requirePortalAccess("UPDATE_CUSTOMER_PROFILE");
  if (!gate.ok) return gate.response;
  setActivePortalMembership(gate.membership.id);
  return NextResponse.json({
    ok: true,
    profile: {
      displayName: gate.membership.displayName,
      email: gate.membership.email,
      phone: gate.membership.phone,
      jobTitle: gate.membership.jobTitle,
      preferredContactMethod: gate.membership.preferredContactMethod,
      timeZone: gate.membership.timeZone,
    },
    notifications: getNotificationPrefs(),
  });
}

export async function PATCH(request: Request) {
  const gate = await requirePortalAccess("UPDATE_CUSTOMER_PROFILE");
  if (!gate.ok) return gate.response;
  setActivePortalMembership(gate.membership.id);
  try {
    const body = (await request.json()) as Record<string, unknown>;
    // Block privileged fields
    for (const key of [
      "customerId",
      "role",
      "organizationId",
      "canManageUsers",
      "canApproveService",
      "status",
    ]) {
      if (key in body) {
        return NextResponse.json(
          { ok: false, error: `Field "${key}" cannot be updated.` },
          { status: 400 },
        );
      }
    }
    const result = updatePortalProfile({
      phone: body.phone as string | undefined,
      jobTitle: body.jobTitle as string | undefined,
      preferredContactMethod: body.preferredContactMethod as
        | "EMAIL"
        | "PHONE"
        | "SMS"
        | undefined,
      timeZone: body.timeZone as string | undefined,
      defaultLocationId: body.defaultLocationId as string | null | undefined,
    });
    if (!result.ok) return NextResponse.json(result, { status: 400 });
    await writeAdminAudit({
      organizationId: gate.actor.organizationId,
      actorId: gate.actor.userId,
      action: "PORTAL_PROFILE_UPDATED",
      entityType: "CustomerMembership",
      entityId: gate.membership.id,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Update failed." },
      { status: 400 },
    );
  }
}
