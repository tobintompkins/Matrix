import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { assignDataQualityIssue } from "@/lib/data-quality/scan";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "ASSIGN_DATA_QUALITY_ISSUE");
  if (denied) return denied;
  const { id } = await ctx.params;
  const body = (await req.json()) as {
    assignedToUserId?: string;
    dueAt?: string | null;
    note?: string;
  };
  if (!body.assignedToUserId) {
    return NextResponse.json(
      { ok: false, error: "assignedToUserId is required." },
      { status: 400 },
    );
  }
  const result = await assignDataQualityIssue({
    actor,
    id,
    assignedToUserId: body.assignedToUserId,
    dueAt: body.dueAt,
    note: body.note,
  });
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result);
}
