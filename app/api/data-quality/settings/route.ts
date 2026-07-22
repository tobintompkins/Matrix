import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { writeAdminAudit } from "@/lib/admin/repository";
import {
  getDataQualitySettings,
  updateDataQualitySettings,
} from "@/lib/data-quality/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "VIEW_DATA_QUALITY_CENTER");
  if (denied) return denied;
  const settings = await getDataQualitySettings(actor.organizationId);
  return NextResponse.json({
    ok: true,
    settings,
    schedulerAvailable: false,
    note: "Automatic scan scheduling is unavailable in this environment. Manual scans are supported.",
  });
}

export async function PATCH(req: Request) {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "MANAGE_DATA_QUALITY_SETTINGS");
  if (denied) return denied;
  const body = (await req.json()) as Record<string, unknown>;
  try {
    await updateDataQualitySettings({
      organizationId: actor.organizationId,
      settings: body,
      actorUserId: actor.userId,
    });
    await writeAdminAudit({
      organizationId: actor.organizationId,
      actorId: actor.userId,
      action: "DATA_QUALITY_SETTINGS_UPDATED",
      entityType: "DataQualitySetting",
      entityId: actor.organizationId,
    });
    const settings = await getDataQualitySettings(actor.organizationId);
    return NextResponse.json({ ok: true, settings });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Failed." },
      { status: 400 },
    );
  }
}
