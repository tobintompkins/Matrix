import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { resolveDataQualityIssue } from "@/lib/data-quality/scan";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "RESOLVE_DATA_QUALITY_ISSUE");
  if (denied) return denied;
  const { id } = await ctx.params;
  const body = (await req.json()) as {
    resolutionMethod?: string;
    resolutionNote?: string;
  };
  const result = await resolveDataQualityIssue({
    actor,
    id,
    resolutionMethod: body.resolutionMethod ?? "MANUAL_FIX",
    resolutionNote: body.resolutionNote ?? "",
  });
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result);
}
