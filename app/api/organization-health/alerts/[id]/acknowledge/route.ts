import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { acknowledgeHealthAlert } from "@/lib/organization-health/alerts";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: Ctx) {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "ACKNOWLEDGE_HEALTH_ALERTS");
  if (denied) return denied;
  const { id } = await context.params;
  const result = await acknowledgeHealthAlert({ actor, id });
  if (!result.ok) return NextResponse.json(result, { status: 404 });
  return NextResponse.json(result);
}
