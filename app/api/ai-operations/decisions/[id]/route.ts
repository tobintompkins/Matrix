import { NextRequest, NextResponse } from "next/server";
import { forbidUnlessAi, resolveAiActor } from "@/lib/ai/auth";
import { hasMatrixPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import { serializeDecision } from "@/lib/decision-engine";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "VIEW_DECISION_CENTER");
  if (denied) return denied;

  const { id } = await ctx.params;
  const includeCosts = hasMatrixPermission(actor.role, "VIEW_DECISION_COSTS");

  const row = await prisma.decisionRecommendation.findFirst({
    where: { id, organizationId: DEFAULT_ORG_ID },
  });
  if (!row) {
    return NextResponse.json(
      { ok: false, error: "Decision not found." },
      { status: 404 },
    );
  }

  const history = await prisma.decisionHistoryEvent.findMany({
    where: { decisionId: id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({
    ok: true,
    decision: serializeDecision(row, { includeCosts }),
    history: history.map((h) => ({
      id: h.id,
      action: h.action,
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      actorUserId: h.actorUserId,
      actorName: h.actorName,
      reason: h.reason,
      notes: h.notes,
      createdAt: h.createdAt.toISOString(),
    })),
    advisory:
      "Recommendations are decision support only. High-impact actions require human approval and use existing Matrix workflows.",
  });
}
