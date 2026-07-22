import { NextResponse } from "next/server";
import { forbidUnlessAi, resolveAiActor } from "@/lib/ai/auth";
import { executeAutomation } from "@/lib/automations/engine/execute-automation";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "RUN_AI_AUTOMATIONS");
  if (denied) return denied;
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as {
    dryRun?: boolean;
    payload?: Record<string, unknown>;
  };
  const result = await executeAutomation({
    automationId: id,
    organizationId: DEFAULT_ORG_ID,
    triggerSource: body.dryRun ? "MANUAL_DRY_RUN" : "MANUAL",
    triggerReferenceId: `manual-${Date.now()}`,
    payload: body.payload ?? { manual: true },
    initiatedById: actor.userId,
    dryRun: body.dryRun !== false,
    force: true,
  });
  if (!result.ok && !result.executionId) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({
    ok: true,
    executionId: result.executionId,
    status: result.status,
    skipped: result.skipped,
    error: result.error,
  });
}
