import { NextRequest, NextResponse } from "next/server";
import { forbidUnlessAi, resolveAiActor } from "@/lib/ai/auth";
import { hasMatrixPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import {
  getOrCreateDecisionSettings,
  serializeDecision,
} from "@/lib/decision-engine";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "VIEW_DECISION_CENTER");
  if (denied) return denied;

  await getOrCreateDecisionSettings(DEFAULT_ORG_ID);
  const includeCosts = hasMatrixPermission(actor.role, "VIEW_DECISION_COSTS");
  const viewAll = hasMatrixPermission(actor.role, "VIEW_ALL_DECISIONS");

  const sp = req.nextUrl.searchParams;
  const status = sp.get("status") || "";
  const priority = sp.get("priority") || "";
  const decisionType = sp.get("decisionType") || "";
  const machineId = sp.get("machineId") || "";
  const customerId = sp.get("customerId") || "";
  const assignedTo = sp.get("assignedTo") || "";
  const q = (sp.get("q") || "").trim().toLowerCase();
  const from = sp.get("from");
  const to = sp.get("to");
  const sort = sp.get("sort") || "score";
  const take = Math.min(Number(sp.get("pageSize") || 50), 100);

  const where: Record<string, unknown> = {
    organizationId: DEFAULT_ORG_ID,
  };
  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (decisionType) where.decisionType = decisionType;
  if (machineId) where.machineId = machineId;
  if (customerId) where.customerId = { contains: customerId };
  if (assignedTo) where.assignedToUserId = assignedTo;
  if (!viewAll) {
    where.OR = [
      { assignedToUserId: actor.userId },
      { technicianId: { contains: actor.displayName } },
      { status: { in: ["NEW", "REVIEW_REQUIRED", "APPROVED", "ASSIGNED", "IN_PROGRESS"] } },
    ];
  }
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }

  const orderBy =
    sort === "newest"
      ? { createdAt: "desc" as const }
      : sort === "priority"
        ? { priority: "asc" as const }
        : { overallDecisionScore: "desc" as const };

  const rows = await prisma.decisionRecommendation.findMany({
    where,
    orderBy,
    take,
  });

  const filtered = q
    ? rows.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.summary.toLowerCase().includes(q) ||
          (r.machineId ?? "").toLowerCase().includes(q) ||
          (r.customerId ?? "").toLowerCase().includes(q),
      )
    : rows;

  return NextResponse.json({
    ok: true,
    items: filtered.map((r) => serializeDecision(r, { includeCosts })),
    meta: {
      count: filtered.length,
      includeCosts,
      viewAll,
      sampleMode: true,
    },
  });
}
