import { NextResponse } from "next/server";
import { requirePortalAccess, portalNotFound } from "@/lib/portal/auth";
import {
  portalCreateServiceRequest,
  portalGetServiceRequest,
  portalListServiceRequests,
} from "@/lib/portal/enterprise";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requirePortalAccess("VIEW_CUSTOMER_SERVICE_CALLS");
  if (!gate.ok) return gate.response;
  try {
    const items = await portalListServiceRequests(
      gate.membership,
      gate.actor.organizationId,
    );
    return NextResponse.json({ ok: true, items });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Load failed." },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  const gate = await requirePortalAccess("CREATE_CUSTOMER_SERVICE_CALL");
  if (!gate.ok) return gate.response;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    // Never trust client customer/requester identity
    const result = await portalCreateServiceRequest(
      gate.membership,
      body,
      gate.actor.organizationId,
    );
    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Create failed." },
      { status: 400 },
    );
  }
}
