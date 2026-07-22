import { NextResponse } from "next/server";
import { requirePortalAccess } from "@/lib/portal/auth";
import { portalListDocuments } from "@/lib/portal/enterprise";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requirePortalAccess("VIEW_CUSTOMER_DOCUMENTS");
  if (!gate.ok) return gate.response;
  const items = portalListDocuments(gate.membership);
  return NextResponse.json({ ok: true, items });
}
