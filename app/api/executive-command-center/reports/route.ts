import { NextRequest, NextResponse } from "next/server";
import { forbidUnlessAi, resolveAiActor } from "@/lib/ai/auth";
import {
  analyticsToCsv,
  getExecutiveAnalytics,
} from "@/lib/executive-command-center";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import { writeAdminAudit } from "@/lib/admin/repository";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "VIEW_EXECUTIVE_COMMAND_CENTER");
  if (denied) return denied;

  try {
    const range = req.nextUrl.searchParams.get("range");
    const format = (req.nextUrl.searchParams.get("format") || "json").toLowerCase();
    const analytics = await getExecutiveAnalytics({
      organizationId: DEFAULT_ORG_ID,
      range,
    });

    try {
      await writeAdminAudit({
        organizationId: DEFAULT_ORG_ID,
        actorId: actor.userId,
        action: "EXECUTIVE_REPORT_VIEWED",
        entityType: "ExecutiveCommandCenter",
        message: `Executive report (${format}) for ${analytics.range}`,
        category: "AI_OPERATIONS",
        severity: "INFO",
        outcome: "SUCCESS",
      });
    } catch {
      /* best-effort */
    }

    if (format === "csv") {
      const csv = analyticsToCsv(analytics);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="executive-report-${analytics.range.toLowerCase()}.csv"`,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      report: {
        range: analytics.range,
        rangeLabel: analytics.rangeLabel,
        generatedAt: analytics.generatedAt,
        sections: analytics.reports,
        kpiSnapshot: analytics.kpiTrends.current,
      },
    });
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
