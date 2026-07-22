import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { startDataQualityIssueReview } from "@/lib/data-quality/scan";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "ASSIGN_DATA_QUALITY_ISSUE");
  if (denied) return denied;
  const { id } = await ctx.params;
  const result = await startDataQualityIssueReview({ actor, id });
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result);
}
