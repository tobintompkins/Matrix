import { NextResponse } from "next/server";
import { forbidUnlessAi, resolveAiActor } from "@/lib/ai/auth";
import {
  getAnalysisRun,
  requestCancelAnalysisRun,
} from "@/lib/ai/analysis-runner";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "VIEW_AI_HEALTH");
  if (denied) return denied;
  const { id } = await ctx.params;
  const run = await getAnalysisRun(id, DEFAULT_ORG_ID);
  if (!run) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, run });
}

export async function POST(request: Request, ctx: Ctx) {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "RUN_AI_ANALYSIS");
  if (denied) return denied;
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as { action?: string };
  if (body.action !== "cancel") {
    return NextResponse.json({ ok: false, error: "Unsupported action." }, { status: 400 });
  }
  const result = await requestCancelAnalysisRun(id, DEFAULT_ORG_ID);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
