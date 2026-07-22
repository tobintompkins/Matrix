import { NextResponse } from "next/server";
import { requirePortalAccess } from "@/lib/portal/auth";
import { submitContactChangeRequest } from "@/lib/portal/contacts";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const gate = await requirePortalAccess("UPDATE_CUSTOMER_PROFILE");
  if (!gate.ok) return gate.response;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const result = await submitContactChangeRequest({
      membership: gate.membership,
      contactId: (body.contactId as string) ?? null,
      name: body.name as string | undefined,
      phone: body.phone as string | undefined,
      email: body.email as string | undefined,
      jobTitle: body.jobTitle as string | undefined,
      note: body.note as string | undefined,
      organizationId: gate.actor.organizationId,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Request failed." },
      { status: 400 },
    );
  }
}
