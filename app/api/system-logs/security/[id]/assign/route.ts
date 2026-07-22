import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { assignSecurityEvent } from "@/lib/system-logs/security";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "ASSIGN_SECURITY_EVENT");
  if (denied) return denied;
  const { id } = await ctx.params;
  const body = (await req.json()) as { assignedUserId?: string };
  const result = await assignSecurityEvent({
    actor,
    id,
    assignedUserId: body.assignedUserId ?? "",
  });
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result);
}
