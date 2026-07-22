import { NextResponse } from "next/server";
import { forbidUnlessAi, resolveAiActor } from "@/lib/ai/auth";
import { getExecutiveCommandCenterSummary } from "@/lib/executive-command-center";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import { writeAdminAudit } from "@/lib/admin/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "VIEW_EXECUTIVE_COMMAND_CENTER");
  if (denied) {
    try {
      await writeAdminAudit({
        organizationId: DEFAULT_ORG_ID,
        actorId: actor.userId,
        action: "EXECUTIVE_COMMAND_CENTER_DENIED",
        entityType: "ExecutiveCommandCenter",
        message: "Permission denied for executive command center summary.",
        category: "AUTHORIZATION",
        severity: "WARNING",
        outcome: "BLOCKED",
      });
    } catch {
      /* best-effort */
    }
    return denied;
  }

  try {
    const summary = await getExecutiveCommandCenterSummary(DEFAULT_ORG_ID);
    try {
      await writeAdminAudit({
        organizationId: DEFAULT_ORG_ID,
        actorId: actor.userId,
        action: "EXECUTIVE_COMMAND_CENTER_VIEWED",
        entityType: "ExecutiveCommandCenter",
        message: "Executive Command Center summary loaded.",
        category: "AI_OPERATIONS",
        severity: "INFO",
        outcome: "SUCCESS",
      });
    } catch {
      /* view audit is optional */
    }
    return NextResponse.json({ ok: true, summary });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load summary.";
    try {
      await writeAdminAudit({
        organizationId: DEFAULT_ORG_ID,
        actorId: actor.userId,
        action: "EXECUTIVE_COMMAND_CENTER_ERROR",
        entityType: "ExecutiveCommandCenter",
        message,
        category: "AI_OPERATIONS",
        severity: "ERROR",
        outcome: "FAILURE",
      });
    } catch {
      /* best-effort */
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
