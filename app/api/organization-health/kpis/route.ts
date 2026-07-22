import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { getOrganizationHealthSummary } from "@/lib/organization-health/summary";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "VIEW_ORGANIZATION_HEALTH");
  if (denied) return denied;
  const data = await getOrganizationHealthSummary(actor);
  if (!data.ok || !data.enabled || !("executiveKpis" in data)) {
    return NextResponse.json(data);
  }
  return NextResponse.json({
    ok: true,
    kpis: data.executiveKpis,
    freshness: data.freshness,
  });
}
