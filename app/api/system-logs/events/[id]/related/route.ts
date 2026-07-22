import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { getRelatedSystemLogEvents } from "@/lib/system-logs/query";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "VIEW_SYSTEM_LOGS");
  if (denied) return denied;
  const { id } = await ctx.params;
  const result = await getRelatedSystemLogEvents({
    organizationId: actor.organizationId,
    role: actor.role,
    id,
  });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }
  return NextResponse.json(result);
}
