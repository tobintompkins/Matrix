import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { exportDataQuality } from "@/lib/data-quality/export";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "EXPORT_DATA_QUALITY");
  if (denied) return denied;
  const kind = new URL(req.url).searchParams.get("kind") ?? "summary";
  const result = await exportDataQuality(actor, kind);
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }
  return new NextResponse(result.csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
    },
  });
}
