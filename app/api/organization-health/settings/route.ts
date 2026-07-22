import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import {
  getOrganizationHealthSettings,
  updateOrganizationHealthSettings,
} from "@/lib/organization-health/settings";
import { writeAdminAudit } from "@/lib/admin/repository";
import type { HealthSettings } from "@/lib/organization-health/score";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "VIEW_ORGANIZATION_HEALTH");
  if (denied) return denied;
  const settings = await getOrganizationHealthSettings(actor.organizationId);
  return NextResponse.json({ ok: true, settings });
}

export async function PATCH(request: Request) {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "MANAGE_HEALTH_SCORE_WEIGHTS");
  if (denied) return denied;
  try {
    const body = (await request.json()) as Partial<HealthSettings>;
    await updateOrganizationHealthSettings({
      organizationId: actor.organizationId,
      settings: body,
      actorUserId: actor.userId,
    });
    const settings = await getOrganizationHealthSettings(actor.organizationId);
    await writeAdminAudit({
      organizationId: actor.organizationId,
      actorId: actor.userId,
      action: "HEALTH_SCORE_SETTINGS_UPDATED",
      entityType: "OrganizationHealthSetting",
      entityId: actor.organizationId,
    });
    return NextResponse.json({ ok: true, settings });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Update failed." },
      { status: 400 },
    );
  }
}
