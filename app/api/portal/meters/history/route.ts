import { NextResponse } from "next/server";
import { requirePortalAccess } from "@/lib/portal/auth";
import { listPortalMeterHistory } from "@/lib/portal/meters";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requirePortalAccess("VIEW_CUSTOMER_METER_HISTORY");
  if (!gate.ok) return gate.response;
  const items = listPortalMeterHistory(gate.membership);
  return NextResponse.json({ ok: true, items });
}
