import { NextResponse } from "next/server";
import { getTechnicianPmDashboard } from "@/lib/maintenance/pm-prisma-repository";
import {
  forbidUnless,
  resolvePmApiActor,
  resolveScopedTechnician,
} from "@/lib/maintenance/pm-api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const actor = await resolvePmApiActor();
    const denied = forbidUnless(actor, "VIEW_FLEET_MAINTENANCE");
    if (denied) return denied;

    const url = new URL(request.url);
    const scoped = resolveScopedTechnician(
      actor,
      url.searchParams.get("technician"),
    );
    if (!scoped.ok) return scoped.response;

    const data = await getTechnicianPmDashboard(scoped.technician);
    return NextResponse.json(
      {
        ok: true,
        data,
        scopedToSelf: !actor.canViewAllTechnicians,
        actorDisplayName: actor.displayName,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
