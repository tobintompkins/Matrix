import { NextResponse } from "next/server";
import { forbidUnlessAi, resolveAiActor } from "@/lib/ai/auth";
import { listAnalysisRuns, runAiAnalysis } from "@/lib/ai/analysis-runner";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "VIEW_AI_HEALTH");
  if (denied) return denied;
  const url = new URL(request.url);
  const result = await listAnalysisRuns({
    organizationId: DEFAULT_ORG_ID,
    page: Number(url.searchParams.get("page") ?? "1"),
    pageSize: Number(url.searchParams.get("pageSize") ?? "20"),
  });
  return NextResponse.json({ ok: true, ...result });
}

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
