import { NextResponse } from "next/server";
import { requirePortalAccess } from "@/lib/portal/auth";
import {
  createPortalPartsRequest,
  listPortalPartsRequests,
} from "@/lib/portal/parts";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requirePortalAccess("VIEW_CUSTOMER_PARTS_REQUESTS");
  if (!gate.ok) return gate.response;
  const items = await listPortalPartsRequests(gate.membership);
  return NextResponse.json({ ok: true, items });
}

export async function POST(request: Request) {
  const gate = await requirePortalAccess("CREATE_CUSTOMER_PARTS_REQUEST");
  if (!gate.ok) return gate.response;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const result = await createPortalPartsRequest({
      membership: gate.membership,
      machineId: (body.machineId as string) ?? null,
      locationId: (body.locationId as string) ?? null,
      requestType: String(body.requestType ?? "Other"),
      description: String(body.description ?? ""),
      quantity: Number(body.quantity ?? 1),
      businessReason: (body.businessReason as string) ?? null,
      urgency: (body.urgency as string) ?? "NORMAL",
      serviceRequestId: (body.serviceRequestId as string) ?? null,
      shippingContact: (body.shippingContact as string) ?? null,
      shippingAddress: (body.shippingAddress as string) ?? null,
      organizationId: gate.actor.organizationId,
    });
    if (!result.ok) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Create failed." },
      { status: 400 },
    );
  }
}
