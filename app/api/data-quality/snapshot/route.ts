import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { createDataQualitySnapshot } from "@/lib/data-quality/summary";

export const dynamic = "force-dynamic";

export async function POST() {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "RUN_DATA_QUALITY_SCAN");
  if (denied) return denied;
  try {
    return NextResponse.json(await createDataQualitySnapshot(actor));
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Failed." },
      { status: 500 },
    );
  }
}
