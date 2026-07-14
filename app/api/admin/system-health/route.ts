import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { getSystemHealth } from "@/lib/admin/completion/system-health";
import { writeAdminAudit } from "@/lib/admin/repository";

export async function GET() {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "VIEW_SYSTEM_HEALTH");
  if (denied) return denied;

  try {
    const data = await getSystemHealth(actor.organizationId);
    await writeAdminAudit({
      organizationId: actor.organizationId,
      actorId: actor.userId,
      action: "SYSTEM_HEALTH_VIEWED",
      entityType: "SystemHealth",
      entityId: actor.organizationId,
      payload: { overall: data.overall },
    });
    return NextResponse.json({ ok: true, data });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Unable to load System Health." },
      { status: 500 },
    );
  }
}
