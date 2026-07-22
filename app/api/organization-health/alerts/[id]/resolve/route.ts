import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { resolveHealthAlert } from "@/lib/organization-health/alerts";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "RESOLVE_HEALTH_ALERTS");
  if (denied) return denied;
  const { id } = await context.params;
  const body = (await request.json()) as { resolutionNote?: string };
  const result = await resolveHealthAlert({
    actor,
    id,
    resolutionNote: body.resolutionNote ?? "",
  });
  if (!result.ok) {
    return NextResponse.json(result, {
      status: result.error.includes("required") ? 400 : 404,
    });
  }
  return NextResponse.json(result);
}
