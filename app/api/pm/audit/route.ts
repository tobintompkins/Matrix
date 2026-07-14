import { NextResponse } from "next/server";
import { listPmAuditLog } from "@/lib/maintenance/pm-prisma-repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const machineId = url.searchParams.get("machineId") ?? undefined;
    const limit = url.searchParams.get("limit")
      ? Number(url.searchParams.get("limit"))
      : undefined;
    const rows = await listPmAuditLog({ machineId, limit });
    return NextResponse.json(
      { ok: true, rows },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
