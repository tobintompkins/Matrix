import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { calculateDataQualityScore } from "@/lib/data-quality/summary";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "VIEW_DATA_QUALITY_CENTER");
  if (denied) return denied;
  try {
    const score = await calculateDataQualityScore(actor.organizationId);
    return NextResponse.json({ ok: true, score });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Failed." },
      { status: 500 },
    );
  }
}
