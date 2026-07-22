import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { assignHealthAlert } from "@/lib/organization-health/alerts";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "ASSIGN_HEALTH_ALERTS");
  if (denied) return denied;
  const { id } = await context.params;
  const body = (await request.json()) as { assignedUserId?: string };
  if (!body.assignedUserId) {
    return NextResponse.json(
      { ok: false, error: "assignedUserId is required." },
      { status: 400 },
    );
  }
  const result = await assignHealthAlert({
    actor,
    id,
    assignedUserId: body.assignedUserId,
  });
  if (!result.ok) return NextResponse.json(result, { status: 404 });
  return NextResponse.json(result);
}
