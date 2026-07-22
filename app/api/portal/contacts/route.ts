import { NextResponse } from "next/server";
import { requirePortalAccess } from "@/lib/portal/auth";
import { listPortalContacts } from "@/lib/portal/contacts";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requirePortalAccess("VIEW_CUSTOMER_CONTACTS");
  if (!gate.ok) return gate.response;
  const data = listPortalContacts(gate.membership);
  return NextResponse.json({ ok: true, ...data });
}
