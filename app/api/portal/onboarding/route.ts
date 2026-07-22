import { NextResponse } from "next/server";
import { requirePortalAccess, portalNotFound } from "@/lib/portal/auth";
import { getPortalOnboarding, updatePortalOnboarding } from "@/lib/portal/onboarding";
import { writeAdminAudit } from "@/lib/admin/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requirePortalAccess("ACCESS_CUSTOMER_PORTAL");
  if (!gate.ok) return gate.response;
  const state = await getPortalOnboarding(gate.membership.id);
  return NextResponse.json({ ok: true, ...state });
}

export async function PATCH(request: Request) {
  const gate = await requirePortalAccess("ACCESS_CUSTOMER_PORTAL");
  if (!gate.ok) return gate.response;
  try {
    const body = (await request.json()) as {
      steps?: Record<string, boolean>;
      acceptTerms?: boolean;
      complete?: boolean;
    };
    const state = await updatePortalOnboarding({
      membershipId: gate.membership.id,
      steps: body.steps,
      acceptTerms: body.acceptTerms === true,
      complete: body.complete === true,
    });
    if (state.completed) {
      await writeAdminAudit({
        organizationId: gate.actor.organizationId,
        actorId: gate.actor.userId,
        action: "PORTAL_ONBOARDING_COMPLETED",
        entityType: "CustomerMembership",
        entityId: gate.membership.id,
        payload: { customerId: gate.membership.customerId },
      });
    }
    return NextResponse.json({ ok: true, ...state });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Update failed." },
      { status: 400 },
    );
  }
}
