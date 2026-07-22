import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { listDataQualityIssues } from "@/lib/data-quality/scan";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "VIEW_DATA_QUALITY_ISSUES");
  if (denied) return denied;
  const sp = new URL(req.url).searchParams;
  try {
    const data = await listDataQualityIssues(actor.organizationId, {
      status: sp.get("status") ?? undefined,
      severity: sp.get("severity") ?? undefined,
      module: sp.get("module") ?? undefined,
      issueType: sp.get("issueType") ?? undefined,
      assignedToUserId: sp.get("assignedToUserId") ?? undefined,
      search: sp.get("q") ?? undefined,
      page: Number(sp.get("page") ?? "1"),
      pageSize: Number(sp.get("pageSize") ?? "25"),
    });
    return NextResponse.json({ ok: true, ...data });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Failed." },
      { status: 500 },
    );
  }
}
