import { NextResponse } from "next/server";
import { forbidUnlessAi, resolveAiActor } from "@/lib/ai/auth";
import { prisma } from "@/lib/db/prisma";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import { writePredictiveAudit } from "@/lib/predictive-maintenance/settings";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "VIEW_PREDICTIVE_MAINTENANCE");
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "OPEN";
  const items = await prisma.predictiveRiskAlert.findMany({
    where: {
      organizationId: DEFAULT_ORG_ID,
      ...(status ? { status } : {}),
    },
    orderBy: { openedAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ ok: true, items });
}

export async function PATCH(request: Request) {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "ACKNOWLEDGE_PREDICTIVE_ALERTS");
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    action?: "acknowledge" | "resolve" | "dismiss";
  };
  if (!body.id || !body.action) {
    return NextResponse.json(
      { ok: false, error: "id and action are required." },
      { status: 400 },
    );
  }

  const data: Record<string, unknown> = { updatedAt: new Date() };
  if (body.action === "acknowledge") {
    data.status = "ACKNOWLEDGED";
    data.acknowledgedById = actor.userId;
    data.acknowledgedAt = new Date();
  } else if (body.action === "resolve") {
    data.status = "RESOLVED";
    data.resolvedAt = new Date();
  } else if (body.action === "dismiss") {
    data.status = "DISMISSED";
    data.resolvedAt = new Date();
  }

  const updated = await prisma.predictiveRiskAlert.update({
    where: { id: body.id },
    data,
  });
  await writePredictiveAudit({
    action: `predictive.alert_${body.action}`,
    entityType: "PredictiveRiskAlert",
    entityId: body.id,
    actorUserId: actor.userId,
  });
  return NextResponse.json({ ok: true, item: updated });
}
