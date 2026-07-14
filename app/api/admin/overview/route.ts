import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { getAdminOverview } from "@/lib/admin/overview";
import { writeAdminAudit } from "@/lib/admin/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "VIEW_ADMIN_OVERVIEW");
  if (denied) {
    const fallback = forbidUnless(actor, "VIEW_ADMINISTRATION");
    if (fallback) return fallback;
  }

  try {
    const data = await getAdminOverview(actor.organizationId);
    await writeAdminAudit({
      organizationId: actor.organizationId,
      actorId: actor.userId,
      action: "ADMIN_CENTER_VIEWED",
      entityId: "overview",
    }).catch(() => undefined);
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unable to load administration overview.",
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 503 },
    );
  }
}
