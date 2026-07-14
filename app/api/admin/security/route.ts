import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { getSecuritySummary } from "@/lib/admin/overview";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "VIEW_SECURITY_CENTER");
  if (denied) return denied;
  try {
    const data = await getSecuritySummary(actor.organizationId);
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unable to load security summary.",
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 503 },
    );
  }
}
