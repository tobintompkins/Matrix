import { NextResponse } from "next/server";
import { forbidUnlessAi, resolveAiActor } from "@/lib/ai/auth";
import { runAiAnalysis } from "@/lib/ai/analysis-runner";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";

export const dynamic = "force-dynamic";

/** Alias for POST /api/ai-operations/analysis/runs */
export async function POST() {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "RUN_AI_ANALYSIS");
  if (denied) return denied;
  const result = await runAiAnalysis({
    organizationId: DEFAULT_ORG_ID,
    requestedByUserId: actor.userId,
    requestedByName: actor.displayName,
  });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 409 });
  }
  return NextResponse.json({ ok: true, run: result.run });
}
