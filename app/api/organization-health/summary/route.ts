import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { getOrganizationHealthSummary } from "@/lib/organization-health/summary";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "VIEW_ORGANIZATION_HEALTH");
  if (denied) return denied;
  try {
    const data = await getOrganizationHealthSummary(actor);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Failed to load." },
      { status: 500 },
    );
  }
}
