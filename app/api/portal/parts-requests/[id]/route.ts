import { NextResponse } from "next/server";
import { requirePortalAccess, portalNotFound } from "@/lib/portal/auth";
import { getPortalPartsRequest } from "@/lib/portal/parts";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  const gate = await requirePortalAccess("VIEW_CUSTOMER_PARTS_REQUESTS");
  if (!gate.ok) return gate.response;
  const { id } = await context.params;
  const item = await getPortalPartsRequest(gate.membership, id);
  if (!item) return portalNotFound();
  return NextResponse.json({ ok: true, item });
}
