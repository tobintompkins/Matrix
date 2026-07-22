import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { resolveSecurityEvent } from "@/lib/system-logs/security";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "RESOLVE_SECURITY_EVENT");
  if (denied) return denied;
  const { id } = await ctx.params;
  const body = (await req.json()) as { note?: string };
  const result = await resolveSecurityEvent({
    actor,
    id,
    note: body.note ?? "",
  });
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result);
}
