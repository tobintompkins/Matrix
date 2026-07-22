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
  const status = searchParams.get("status") ?? "";
  const items = await prisma.predictiveMaintenanceRecommendation.findMany({
    where: {
      organizationId: DEFAULT_ORG_ID,
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ ok: true, items });
}

export async function PATCH(request: Request) {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "MANAGE_PREDICTIVE_RECOMMENDATIONS");
  if (denied) {
    // Technicians may acknowledge
    const ackDenied = forbidUnlessAi(actor, "ACKNOWLEDGE_PREDICTIVE_ALERTS");
    if (ackDenied) return denied;
  }

  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    action?: "acknowledge" | "accept" | "dismiss" | "complete";
    dismissalReason?: string;
  };
  if (!body.id || !body.action) {
    return NextResponse.json(
      { ok: false, error: "id and action are required." },
      { status: 400 },
    );
  }

  const existing = await prisma.predictiveMaintenanceRecommendation.findUnique({
    where: { id: body.id },
  });
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }

  const data: Record<string, unknown> = { updatedAt: new Date() };
  if (body.action === "acknowledge") {
    data.status = "ACKNOWLEDGED";
    data.acknowledgedById = actor.userId;
    data.acknowledgedAt = new Date();
  } else if (body.action === "accept") {
    const manageDenied = forbidUnlessAi(actor, "MANAGE_PREDICTIVE_RECOMMENDATIONS");
    if (manageDenied) return manageDenied;
    data.status = "ACCEPTED";
  } else if (body.action === "dismiss") {
    const manageDenied = forbidUnlessAi(actor, "MANAGE_PREDICTIVE_RECOMMENDATIONS");
    if (manageDenied) return manageDenied;
    data.status = "DISMISSED";
    data.dismissedById = actor.userId;
    data.dismissedAt = new Date();
    data.dismissalReason = body.dismissalReason ?? "";
  } else if (body.action === "complete") {
    const manageDenied = forbidUnlessAi(actor, "MANAGE_PREDICTIVE_RECOMMENDATIONS");
    if (manageDenied) return manageDenied;
    data.status = "COMPLETED";
    data.completedAt = new Date();
  }

  const updated = await prisma.predictiveMaintenanceRecommendation.update({
    where: { id: body.id },
    data,
  });
  await writePredictiveAudit({
    action: `predictive.recommendation_${body.action}`,
    entityType: "PredictiveMaintenanceRecommendation",
    entityId: body.id,
    actorUserId: actor.userId,
    payload: { status: updated.status },
  });
  return NextResponse.json({ ok: true, item: updated });
}
