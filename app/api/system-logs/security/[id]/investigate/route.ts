import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { investigateSecurityEvent } from "@/lib/system-logs/security";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "ACKNOWLEDGE_SECURITY_EVENT");
  if (denied) return denied;
  const { id } = await ctx.params;
  const result = await investigateSecurityEvent({ actor, id });
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result);
}
