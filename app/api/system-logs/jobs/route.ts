import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { querySystemLogEvents } from "@/lib/system-logs/query";
import { parseLogFilters } from "@/lib/system-logs/api-helpers";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "VIEW_JOB_LOGS");
  if (denied) return denied;
  const filters = parseLogFilters(new URL(req.url));
  const result = await querySystemLogEvents({
    organizationId: actor.organizationId,
    role: actor.role,
    ...filters,
    category: filters.category ?? "BACKGROUND_JOB",
  });
  return NextResponse.json({
    ...result,
    note: "No durable background job scheduler is installed. This view shows AuditLog BACKGROUND_JOB events only. /admin/jobs remains session-local.",
  });
}
