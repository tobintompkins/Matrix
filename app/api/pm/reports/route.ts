import { NextResponse } from "next/server";
import {
  exportCustomerPmCsv,
  exportPmHistoryCsv,
  exportTechnicianPmCsv,
  getPmReports,
} from "@/lib/maintenance/pm-prisma-repository";
import {
  forbidUnless,
  resolvePmApiActor,
} from "@/lib/maintenance/pm-api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const actor = await resolvePmApiActor();
    const denied = forbidUnless(actor, "VIEW_FLEET_MAINTENANCE");
    if (denied) return denied;

    const url = new URL(request.url);
    const format = (url.searchParams.get("format") ?? "json").toLowerCase();
    const report = (url.searchParams.get("report") ?? "summary").toLowerCase();

    if (format === "csv") {
      if (actor.authenticated && !actor.canExport) {
        const exportDenied = forbidUnless(actor, "EXPORT_MAINTENANCE");
        if (exportDenied) return exportDenied;
      }

      let csv: string;
      let filename: string;
      if (report === "technician") {
        csv = await exportTechnicianPmCsv();
        filename = "technician-pm-activity.csv";
      } else if (report === "customer") {
        csv = await exportCustomerPmCsv();
        filename = "customer-pm-summary.csv";
      } else if (report === "machine") {
        csv = await exportPmHistoryCsv({ page: 1, pageSize: 5000 });
        filename = "machine-pm-history.csv";
      } else {
        csv = await exportPmHistoryCsv({ page: 1, pageSize: 5000 });
        filename = "pm-completion-history.csv";
      }

      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const data = await getPmReports();
    return NextResponse.json(
      { ok: true, data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
