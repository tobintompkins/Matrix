import { NextResponse } from "next/server";
import { forbidUnlessAi, resolveAiActor } from "@/lib/ai/auth";
import { prisma } from "@/lib/db/prisma";
import { createAutomation, ensureAutomationFrameworkSeeded } from "@/lib/automations/service";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "VIEW_AI_AUTOMATIONS");
  if (denied) return denied;
  await ensureAutomationFrameworkSeeded(DEFAULT_ORG_ID);
  const items = await prisma.aiOpsAutomationTemplate.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ ok: true, items });
}

export async function POST(request: Request) {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "CREATE_AI_AUTOMATIONS");
  if (denied) return denied;
  const body = (await request.json()) as { templateId?: string };
  if (!body.templateId) {
    return NextResponse.json({ ok: false, error: "templateId required." }, { status: 400 });
  }
  const template = await prisma.aiOpsAutomationTemplate.findUnique({
    where: { id: body.templateId },
  });
  if (!template) {
    return NextResponse.json({ ok: false, error: "Template not found." }, { status: 404 });
  }
  const def = JSON.parse(template.definitionJson) as Record<string, unknown>;
  const row = await createAutomation({
    actorId: actor.userId,
    data: {
      name: template.name,
      description: template.description,
      category: template.category,
      triggerType: String(def.triggerType ?? "EVENT"),
      eventType: def.eventType ? String(def.eventType) : null,
      scheduleExpression: def.scheduleExpression
        ? String(def.scheduleExpression)
        : null,
      conditionsJson: JSON.stringify(def.conditions ?? { mode: "ALL", conditions: [] }),
      actionsJson: JSON.stringify(def.actions ?? []),
      approvalMode: String(def.approvalMode ?? "NONE"),
      riskLevel: String(def.riskLevel ?? "LOW"),
      status: "DRAFT",
    },
  });
  return NextResponse.json({ ok: true, automation: row });
}
