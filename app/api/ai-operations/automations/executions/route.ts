import { NextResponse } from "next/server";
import { forbidUnlessAi, resolveAiActor } from "@/lib/ai/auth";
import { prisma } from "@/lib/db/prisma";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "VIEW_AI_AUTOMATION_HISTORY");
  if (denied) return denied;
  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? undefined;
  const automationId = url.searchParams.get("automationId") ?? undefined;
  const items = await prisma.aiOpsAutomationExecution.findMany({
    where: {
      organizationId: DEFAULT_ORG_ID,
      ...(status ? { status } : {}),
      ...(automationId ? { automationId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      automation: { select: { name: true, riskLevel: true, triggerType: true } },
      approvals: true,
    },
  });
  return NextResponse.json({ ok: true, items });
}
