import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { exportSystemLogs } from "@/lib/system-logs/export";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "EXPORT_SYSTEM_LOGS");
  if (denied) return denied;
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") ?? "events";
  const result = await exportSystemLogs(actor, kind, {
    category: url.searchParams.get("category") ?? undefined,
    severity: url.searchParams.get("severity") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  return new NextResponse(result.csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
    },
  });
}
