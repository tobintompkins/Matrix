import { NextResponse } from "next/server";
import {
  exportPmHistoryCsv,
  listPmHistory,
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
    const filters = {
      machineId: url.searchParams.get("machineId") ?? undefined,
      technician: url.searchParams.get("technician") ?? undefined,
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
      search: url.searchParams.get("search") ?? undefined,
      statusAtCompletion:
        url.searchParams.get("statusAtCompletion") ?? undefined,
      page: url.searchParams.get("page")
        ? Number(url.searchParams.get("page"))
        : 1,
      pageSize: url.searchParams.get("pageSize")
        ? Number(url.searchParams.get("pageSize"))
        : url.searchParams.get("limit")
          ? Number(url.searchParams.get("limit"))
          : 25,
    };

    if (format === "csv") {
      if (actor.authenticated && !actor.canExport) {
        const exportDenied = forbidUnless(actor, "EXPORT_MAINTENANCE");
        if (exportDenied) return exportDenied;
      }
      const csv = await exportPmHistoryCsv({
        ...filters,
        page: 1,
        pageSize: 5000,
      });
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="pm-history.csv"',
          "Cache-Control": "no-store",
        },
      });
    }

    const data = await listPmHistory(filters);
    return NextResponse.json(
      { ok: true, ...data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
