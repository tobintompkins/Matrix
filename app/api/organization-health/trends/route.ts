import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { getOrganizationHealthTrends } from "@/lib/organization-health/summary";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "VIEW_ORGANIZATION_TRENDS");
  if (denied) return denied;
  const days = Number(new URL(request.url).searchParams.get("days") ?? "30");
  const data = await getOrganizationHealthTrends(actor, days);
  return NextResponse.json(data);
}
