import { NextResponse } from "next/server";
import { requirePortalAccess } from "@/lib/portal/auth";
import { requestPortalPmChange } from "@/lib/portal/pm-change";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  const gate = await requirePortalAccess("VIEW_CUSTOMER_PM");
  if (!gate.ok) return gate.response;
  const { id } = await context.params;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const result = await requestPortalPmChange({
      membership: gate.membership,
      machineId: String(body.machineId ?? id),
      pmId: id,
      requestedDate: (body.requestedDate as string) ?? null,
      reason: String(body.reason ?? ""),
      organizationId: gate.actor.organizationId,
    });
    if (!result.ok) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Request failed." },
      { status: 400 },
    );
  }
}
