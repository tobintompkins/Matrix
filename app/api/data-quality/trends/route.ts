import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { getDataQualityTrends } from "@/lib/data-quality/summary";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "VIEW_DATA_QUALITY_CENTER");
  if (denied) return denied;
  const days = Number(new URL(req.url).searchParams.get("days") ?? "30");
  try {
    const trends = await getDataQualityTrends(
      actor.organizationId,
      Number.isFinite(days) ? days : 30,
    );
    return NextResponse.json({ ok: true, ...trends });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Failed." },
      { status: 500 },
    );
  }
}
