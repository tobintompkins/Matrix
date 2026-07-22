import { NextResponse } from "next/server";
import { forbidUnlessAi, resolveAiActor } from "@/lib/ai/auth";
import { prisma } from "@/lib/db/prisma";
import { continueAfterApproval } from "@/lib/automations/engine/execute-automation";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "APPROVE_AI_AUTOMATIONS");
  if (denied) return denied;
  const items = await prisma.aiOpsAutomationApproval.findMany({
    where: {
      status: "PENDING",
      execution: { organizationId: DEFAULT_ORG_ID },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      execution: {
        include: { automation: { select: { name: true, riskLevel: true } } },
      },
    },
  });
  return NextResponse.json({ ok: true, items });
}

export async function POST(request: Request) {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "APPROVE_AI_AUTOMATIONS");
  if (denied) return denied;
  const body = (await request.json()) as {
    executionId?: string;
    approve?: boolean;
    note?: string;
  };
  if (!body.executionId || typeof body.approve !== "boolean") {
    return NextResponse.json(
      { ok: false, error: "executionId and approve are required." },
      { status: 400 },
    );
  }
  const result = await continueAfterApproval({
    executionId: body.executionId,
    organizationId: DEFAULT_ORG_ID,
    decidedById: actor.userId,
    approve: body.approve,
    note: body.note,
  });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, status: result.status });
}
