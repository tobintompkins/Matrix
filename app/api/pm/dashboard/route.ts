import { NextResponse } from "next/server";
import {
  getPmDashboardSummary,
  listPmDashboardRows,
  type PmDashboardFilters,
} from "@/lib/maintenance/pm-prisma-repository";
import type { PmCleaningStatus } from "@/lib/maintenance/pm-status";

export const dynamic = "force-dynamic";

function parseStatus(
  value: string | null,
): PmCleaningStatus | PmCleaningStatus[] | undefined {
  if (!value) return undefined;
  const parts = value
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean) as PmCleaningStatus[];
  if (parts.length === 0) return undefined;
  return parts.length === 1 ? parts[0] : parts;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const filters: PmDashboardFilters = {
      status: parseStatus(url.searchParams.get("status")),
      customerName: url.searchParams.get("customerName") ?? undefined,
      siteName: url.searchParams.get("siteName") ?? undefined,
      printerModel: url.searchParams.get("printerModel") ?? undefined,
      assignedTechnician:
        url.searchParams.get("assignedTechnician") ?? undefined,
      search: url.searchParams.get("search") ?? undefined,
      activeOnly: url.searchParams.get("activeOnly") !== "false",
    };

    const [rows, summary] = await Promise.all([
      listPmDashboardRows(filters),
      getPmDashboardSummary(),
    ]);

    return NextResponse.json(
      { ok: true, rows, summary },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
