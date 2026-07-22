import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { createOrganizationHealthSnapshot } from "@/lib/organization-health/summary";

export const dynamic = "force-dynamic";

export async function POST() {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "VIEW_ORGANIZATION_HEALTH");
  if (denied) return denied;
  try {
    const result = await createOrganizationHealthSnapshot(actor);
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Snapshot failed." },
      { status: 500 },
    );
  }
}
