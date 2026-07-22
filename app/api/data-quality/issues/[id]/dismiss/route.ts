import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { dismissDataQualityIssue } from "@/lib/data-quality/scan";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "DISMISS_DATA_QUALITY_ISSUE");
  if (denied) return denied;
  const { id } = await ctx.params;
  const body = (await req.json()) as { reason?: string };
  const result = await dismissDataQualityIssue({
    actor,
    id,
    reason: body.reason ?? "",
    asFalsePositive: false,
  });
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result);
}
