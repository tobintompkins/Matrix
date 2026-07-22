import { NextRequest, NextResponse } from "next/server";
import { forbidUnlessAi, resolveAiActor } from "@/lib/ai/auth";
import { getExecutivePeriodReport } from "@/lib/executive-command-center/reporting";
import { exportExecutiveReport } from "@/lib/executive-command-center/export-engine";
import type { ExecutiveExportFormat } from "@/lib/executive-command-center/reporting-types";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import { writeAdminAudit } from "@/lib/admin/repository";
import { recordReportHistory } from "@/lib/executive-command-center/report-configs";
import { checkExecutiveRateLimit } from "@/lib/executive-command-center/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "EXPORT_EXECUTIVE_REPORTS");
  if (denied) return denied;

  const rl = checkExecutiveRateLimit(`export:${actor.userId}`, 10);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Rate limit exceeded.", retryAfterSec: rl.retryAfterSec },
      { status: 429 },
    );
  }

  try {
    const period = req.nextUrl.searchParams.get("period");
    const format = (req.nextUrl.searchParams.get("format") ||
      "csv") as ExecutiveExportFormat;
    const report = await getExecutivePeriodReport({
      organizationId: DEFAULT_ORG_ID,
      period,
      bypassCache: true,
    });
    const safeFormat = ["csv", "excel", "pdf"].includes(format) ? format : "csv";
    const exported = exportExecutiveReport(report, safeFormat);

    try {
      await recordReportHistory({
        organizationId: DEFAULT_ORG_ID,
        period: report.period,
        format: safeFormat,
        title: report.periodLabel,
        filename: exported.filename,
        summary: { highlights: report.highlights },
        createdById: actor.userId,
        createdByName: actor.displayName,
      });
      await writeAdminAudit({
        organizationId: DEFAULT_ORG_ID,
        actorId: actor.userId,
        action: "EXECUTIVE_REPORT_EXPORTED",
        entityType: "ExecutiveCommandCenter",
        message: `Exported ${exported.filename}`,
        category: "AI_OPERATIONS",
        severity: "INFO",
        outcome: "SUCCESS",
      });
    } catch {
      /* best-effort */
    }

    return new NextResponse(exported.content, {
      status: 200,
      headers: {
        "Content-Type": exported.mime,
        "Content-Disposition": `attachment; filename="${exported.filename}"`,
      },
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Export failed.",
      },
      { status: 500 },
    );
  }
}
