import { NextResponse } from "next/server";
import { requirePortalAccess } from "@/lib/portal/auth";
import { portalMe } from "@/lib/portal/enterprise";
import { writeAdminAudit } from "@/lib/admin/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requirePortalAccess("ACCESS_CUSTOMER_PORTAL");
  if (!gate.ok) return gate.response;
  try {
    const me = await portalMe(gate.membership, gate.actor.organizationId);
    await writeAdminAudit({
      organizationId: gate.actor.organizationId,
      actorId: gate.actor.userId,
      action: "PORTAL_LOGIN",
      entityType: "CustomerMembership",
      entityId: gate.membership.id,
      payload: { customerId: gate.membership.customerId },
    });
    return NextResponse.json({ ok: true, ...me });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unable to load profile." },
      { status: 503 },
    );
  }
}
