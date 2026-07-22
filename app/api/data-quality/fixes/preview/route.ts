import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { previewDataQualityFix } from "@/lib/data-quality/fixes";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "FIX_DATA_QUALITY_RECORD");
  if (denied) return denied;
  const body = (await req.json()) as { issueId?: string; fixCode?: string };
  if (!body.issueId || !body.fixCode) {
    return NextResponse.json(
      { ok: false, error: "issueId and fixCode are required." },
      { status: 400 },
    );
  }
  const result = await previewDataQualityFix({
    actor,
    issueId: body.issueId,
    fixCode: body.fixCode,
  });
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result);
}
