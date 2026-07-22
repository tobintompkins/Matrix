import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { exportOrganizationHealthCsv } from "@/lib/organization-health/summary";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "EXPORT_ORGANIZATION_HEALTH");
  if (denied) return denied;
  const result = await exportOrganizationHealthCsv(actor);
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }
  return new NextResponse(result.csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
