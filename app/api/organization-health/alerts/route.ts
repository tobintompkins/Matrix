import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import {
  listOrganizationHealthAlerts,
  serializeAlert,
} from "@/lib/organization-health/alerts";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "VIEW_PREDICTIVE_ALERTS");
  if (denied) return denied;
  const rows = await listOrganizationHealthAlerts(actor.organizationId);
  return NextResponse.json({
    ok: true,
    items: rows.map(serializeAlert),
  });
}
