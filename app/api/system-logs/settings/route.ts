import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { writeAdminAudit } from "@/lib/admin/repository";
import {
  getSystemLogSettings,
  updateSystemLogSettings,
} from "@/lib/system-logs/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "VIEW_SYSTEM_LOGS");
  if (denied) return denied;
  const settings = await getSystemLogSettings(actor.organizationId);
  return NextResponse.json({
    ok: true,
    settings,
    note: "Request/response payload logging defaults to disabled. Debug logging should remain off in production.",
  });
}

export async function PATCH(req: Request) {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "MANAGE_LOG_SETTINGS");
  if (denied) return denied;
  const body = (await req.json()) as Record<string, unknown>;
  try {
    await updateSystemLogSettings({
      organizationId: actor.organizationId,
      settings: body,
      actorUserId: actor.userId,
    });
    await writeAdminAudit({
      organizationId: actor.organizationId,
      actorId: actor.userId,
      action: "SYSTEM_LOG_SETTINGS_UPDATED",
      entityType: "SystemLogSetting",
      entityId: actor.organizationId,
      category: "CONFIGURATION",
      severity: "NOTICE",
      outcome: "SUCCESS",
    });
    const settings = await getSystemLogSettings(actor.organizationId);
    return NextResponse.json({ ok: true, settings });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Failed." },
      { status: 400 },
    );
  }
}
