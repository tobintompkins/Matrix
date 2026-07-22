import { NextRequest, NextResponse } from "next/server";
import { forbidUnlessAi, resolveAiActor } from "@/lib/ai/auth";
import { getExecutivePeriodReport } from "@/lib/executive-command-center/reporting";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "VIEW_EXECUTIVE_REPORTS");
  if (denied) return denied;

  try {
    const period = req.nextUrl.searchParams.get("period");
    const page = Number(req.nextUrl.searchParams.get("page") || "1");
    const pageSize = Number(req.nextUrl.searchParams.get("pageSize") || "5");
    const bypassCache = req.nextUrl.searchParams.get("refresh") === "1";
    const report = await getExecutivePeriodReport({
      organizationId: DEFAULT_ORG_ID,
      period,
      page,
      pageSize,
      bypassCache,
    });
    return NextResponse.json({ ok: true, report });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Failed to build report.",
      },
      { status: 500 },
    );
  }
}
