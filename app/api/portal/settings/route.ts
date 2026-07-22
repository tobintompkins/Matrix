import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { getPortalSettings, updatePortalSettings } from "@/lib/portal/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "ADMINISTER_CUSTOMER_PORTAL");
  if (denied) return denied;
  const settings = await getPortalSettings(actor.organizationId);
  return NextResponse.json({ ok: true, settings });
}

export async function PATCH(request: Request) {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "ADMINISTER_CUSTOMER_PORTAL");
  if (denied) return denied;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    await updatePortalSettings({
      organizationId: actor.organizationId,
      settings: body as Parameters<typeof updatePortalSettings>[0]["settings"],
      actorUserId: actor.userId,
    });
    const settings = await getPortalSettings(actor.organizationId);
    return NextResponse.json({ ok: true, settings });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Update failed." },
      { status: 400 },
    );
  }
}
