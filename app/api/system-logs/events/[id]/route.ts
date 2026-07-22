import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { writeAdminAudit } from "@/lib/admin/repository";
import { getSystemLogEvent } from "@/lib/system-logs/query";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "VIEW_SYSTEM_LOGS");
  if (denied) return denied;
  const { id } = await ctx.params;
  const result = await getSystemLogEvent(
    actor.organizationId,
    actor.role,
    id,
  );
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }
  await writeAdminAudit({
    organizationId: actor.organizationId,
    actorId: actor.userId,
    action: "SYSTEM_LOG_EVENT_VIEWED",
    entityType: "AuditLog",
    entityId: id,
    category: "AUDIT",
    severity: "INFO",
    outcome: "SUCCESS",
  });
  return NextResponse.json(result);
}
