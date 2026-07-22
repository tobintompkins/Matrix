import { NextResponse } from "next/server";
import { requirePortalAccess, portalNotFound } from "@/lib/portal/auth";
import { portalGetServiceRequest } from "@/lib/portal/enterprise";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  const gate = await requirePortalAccess("VIEW_CUSTOMER_SERVICE_CALLS");
  if (!gate.ok) return gate.response;
  const { id } = await context.params;
  try {
    const result = await portalGetServiceRequest(
      gate.membership,
      id,
      gate.actor.organizationId,
    );
    if (!result.ok) return portalNotFound();
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Load failed." },
      { status: 400 },
    );
  }
}
