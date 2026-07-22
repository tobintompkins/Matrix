import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { getApprovalMetrics } from "@/lib/approvals";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "VIEW_APPROVAL_CENTER");
  if (denied) return denied;

  try {
    const metrics = await getApprovalMetrics(actor);
    return NextResponse.json({ ok: true, ...metrics });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unable to load approval metrics.",
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 503 },
    );
  }
}
