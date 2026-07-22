import { NextResponse } from "next/server";
import { requirePortalAccess, portalNotFound } from "@/lib/portal/auth";
import { addPortalMessage } from "@/lib/portal/enterprise";
import { writeAdminAudit } from "@/lib/admin/repository";
import { setActivePortalMembership } from "@/lib/portal/repository";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  const gate = await requirePortalAccess("COMMENT_ON_CUSTOMER_SERVICE_CALL");
  if (!gate.ok) return gate.response;
  const { id } = await context.params;
  try {
    setActivePortalMembership(gate.membership.id);
    const body = (await request.json()) as Record<string, unknown>;
    const result = addPortalMessage({
      ticketId: id,
      body: String(body.body ?? ""),
      attachmentName: (body.attachmentName as string) ?? undefined,
    });
    if (!result.ok) return portalNotFound();
    await writeAdminAudit({
      organizationId: gate.actor.organizationId,
      actorId: gate.actor.userId,
      action: "PORTAL_SERVICE_COMMENT_ADDED",
      entityType: "ServiceCall",
      entityId: id,
      payload: { customerId: gate.membership.customerId },
    });
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Comment failed." },
      { status: 400 },
    );
  }
}
