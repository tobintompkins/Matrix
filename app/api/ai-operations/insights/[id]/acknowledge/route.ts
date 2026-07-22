import { NextResponse } from "next/server";
import { forbidUnlessAi, resolveAiActor } from "@/lib/ai/auth";
import { transitionInsight } from "@/lib/ai/insight-workflow";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "REVIEW_AI_INSIGHTS");
  if (denied) return denied;
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as { note?: string };
  const result = await transitionInsight({
    insightId: id,
    organizationId: DEFAULT_ORG_ID,
    actor: {
      userId: actor.userId,
      displayName: actor.displayName,
      organizationId: DEFAULT_ORG_ID,
    },
    nextStatus: "ACKNOWLEDGED",
    action: "INSIGHT_ACKNOWLEDGED",
    note: body.note,
  });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, insight: result.insight });
}
