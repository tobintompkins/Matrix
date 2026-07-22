import { NextResponse } from "next/server";
import { requirePortalAccess } from "@/lib/portal/auth";
import { disableMembership } from "@/lib/portal/enterprise";
import { setActivePortalMembership } from "@/lib/portal/repository";
import { writeAdminAudit } from "@/lib/admin/repository";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: Ctx) {
  const gate = await requirePortalAccess("MANAGE_CUSTOMER_PORTAL_USERS");
  if (!gate.ok) return gate.response;
  setActivePortalMembership(gate.membership.id);
  const { id } = await context.params;
  const result = disableMembership(id);
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  await writeAdminAudit({
    organizationId: gate.actor.organizationId,
    actorId: gate.actor.userId,
    action: "PORTAL_ACCESS_SUSPENDED",
    entityType: "CustomerMembership",
    entityId: id,
    payload: { customerId: gate.membership.customerId },
  });
  return NextResponse.json(result);
}
