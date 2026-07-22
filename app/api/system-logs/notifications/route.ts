import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { querySystemLogEvents } from "@/lib/system-logs/query";
import { parseLogFilters } from "@/lib/system-logs/api-helpers";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "VIEW_NOTIFICATION_LOGS");
  if (denied) return denied;
  const filters = parseLogFilters(new URL(req.url));
  const result = await querySystemLogEvents({
    organizationId: actor.organizationId,
    role: actor.role,
    ...filters,
    category: filters.category ?? "NOTIFICATION",
  });
  return NextResponse.json({
    ...result,
    note: "Notification delivery confirmation is Not Available. In-app notifications are session-local; only AuditLog NOTIFICATION events appear here.",
  });
}
