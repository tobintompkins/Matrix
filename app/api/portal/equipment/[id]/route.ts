import { NextResponse } from "next/server";
import { requirePortalAccess, portalNotFound } from "@/lib/portal/auth";
import { portalGetEquipment } from "@/lib/portal/enterprise";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  const gate = await requirePortalAccess("VIEW_CUSTOMER_EQUIPMENT");
  if (!gate.ok) return gate.response;
  const { id } = await context.params;
  const result = portalGetEquipment(gate.membership, id);
  if (!result.ok) return portalNotFound();
  return NextResponse.json(result);
}
