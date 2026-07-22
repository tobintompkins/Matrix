import { NextResponse } from "next/server";
import { requirePortalAccess } from "@/lib/portal/auth";
import { portalDashboard } from "@/lib/portal/enterprise";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requirePortalAccess("VIEW_CUSTOMER_DASHBOARD");
  if (!gate.ok) return gate.response;
  try {
    const data = await portalDashboard(
      gate.membership,
      gate.actor.organizationId,
    );
    return NextResponse.json({ ok: true, ...data });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Unable to load dashboard.",
      },
      { status: 503 },
    );
  }
}
