import { NextResponse } from "next/server";
import { forbidUnlessAi, resolveAiActor } from "@/lib/ai/auth";
import { getAiInsight } from "@/lib/ai/insights-query";
import { listInsightEvents, transitionInsight } from "@/lib/ai/insight-workflow";
import type { AiInsightStatus } from "@/lib/ai/insight-types";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import { hasMatrixPermission } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "VIEW_AI_INSIGHTS");
  if (denied) return denied;
  const { id } = await ctx.params;
  const insight = await getAiInsight(id, DEFAULT_ORG_ID);
  if (!insight) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }
  const events = await listInsightEvents(id);
  return NextResponse.json({ ok: true, insight, events });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "REVIEW_AI_INSIGHTS");
  if (denied) return denied;
  const { id } = await ctx.params;
  const body = (await request.json()) as {
    status?: AiInsightStatus;
    note?: string;
    assignedReviewerId?: string | null;
    assignedReviewerName?: string | null;
  };
  if (!body.status) {
    return NextResponse.json({ ok: false, error: "status is required." }, { status: 400 });
  }
  const result = await transitionInsight({
    insightId: id,
    organizationId: DEFAULT_ORG_ID,
    actor: {
      userId: actor.userId,
      displayName: actor.displayName,
      organizationId: DEFAULT_ORG_ID,
    },
    nextStatus: body.status,
    action: "INSIGHT_STATUS_CHANGED",
    note: body.note,
    assignedReviewerId: body.assignedReviewerId,
    assignedReviewerName: body.assignedReviewerName,
    allowOverride: hasMatrixPermission(actor.role, "MANAGE_AI_OPERATIONS"),
  });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, insight: result.insight });
}
