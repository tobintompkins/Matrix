import { NextResponse } from "next/server";
import { requirePortalAccess } from "@/lib/portal/auth";
import { setActivePortalMembership } from "@/lib/portal/repository";
import { buildPortalCustomerContext } from "@/lib/portal/customer-context";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requirePortalAccess("VIEW_CUSTOMER_DASHBOARD");
  if (!gate.ok) {
    const fallback = await requirePortalAccess("ACCESS_CUSTOMER_PORTAL");
    if (!fallback.ok) return fallback.response;
    setActivePortalMembership(fallback.membership.id);
    const ctx = await buildPortalCustomerContext(fallback.membership);
    return NextResponse.json({ ok: true, context: ctx });
  }
  setActivePortalMembership(gate.membership.id);
  const ctx = await buildPortalCustomerContext(gate.membership);
  return NextResponse.json({ ok: true, context: ctx });
}
