import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { getOrganizationHealthSummary } from "@/lib/organization-health/summary";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "VIEW_EXECUTIVE_HEALTH_SCORE");
  if (denied) return denied;
  const data = await getOrganizationHealthSummary(actor);
  if (!data.ok || !data.enabled || !("score" in data)) {
    return NextResponse.json(data);
  }
  return NextResponse.json({ ok: true, score: data.score, freshness: data.freshness });
}
