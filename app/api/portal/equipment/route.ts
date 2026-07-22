import { NextResponse } from "next/server";
import { requirePortalAccess, portalNotFound } from "@/lib/portal/auth";
import {
  portalGetEquipment,
  portalListEquipment,
} from "@/lib/portal/enterprise";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requirePortalAccess("VIEW_CUSTOMER_EQUIPMENT");
  if (!gate.ok) return gate.response;
  try {
    const items = portalListEquipment(gate.membership);
    return NextResponse.json({ ok: true, items });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Load failed." },
      { status: 503 },
    );
  }
}
