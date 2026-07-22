import { NextResponse } from "next/server";
import { forbidUnlessAi, resolveAiActor } from "@/lib/ai/auth";
import { getExecutiveCommandCenterSummary } from "@/lib/executive-command-center";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import { writeAdminAudit } from "@/lib/admin/repository";

export const dynamic = "force-dynamic";

/**
 * Refresh AI executive briefing — recomputes from current aggregates (sample mode).
 * Does not perform destructive actions.
 */
export async function POST() {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "VIEW_EXECUTIVE_COMMAND_CENTER");
  if (denied) return denied;

  try {
    const summary = await getExecutiveCommandCenterSummary(DEFAULT_ORG_ID);
    try {
      await writeAdminAudit({
        organizationId: DEFAULT_ORG_ID,
        actorId: actor.userId,
        action: "EXECUTIVE_BRIEFING_REFRESHED",
        entityType: "ExecutiveCommandCenter",
        message: "AI executive briefing refreshed.",
        category: "AI_OPERATIONS",
        severity: "INFO",
        outcome: "SUCCESS",
        payload: {
          isSample: summary.aiBriefing?.isSample ?? true,
          confidence: summary.aiBriefing?.confidence ?? 0,
        },
      });
    } catch {
      /* best-effort */
    }
    return NextResponse.json({
      ok: true,
      briefing: summary.aiBriefing,
      generatedAt: summary.generatedAt,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Briefing refresh failed.",
      },
      { status: 500 },
    );
  }
}
