import { NextResponse } from "next/server";
import { forbidUnlessAi, resolveAiActor } from "@/lib/ai/auth";
import {
  createAutomation,
  getAutomationOverview,
  listAutomations,
} from "@/lib/automations/service";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "VIEW_AI_AUTOMATIONS");
  if (denied) return denied;
  const url = new URL(request.url);
  if (url.searchParams.get("overview") === "1") {
    const overview = await getAutomationOverview(DEFAULT_ORG_ID);
    return NextResponse.json({ ok: true, overview });
  }
  const items = await listAutomations({
    organizationId: DEFAULT_ORG_ID,
    status: url.searchParams.get("status") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
  });
  return NextResponse.json({ ok: true, items });
}

export async function POST(request: Request) {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "CREATE_AI_AUTOMATIONS");
  if (denied) return denied;
  const body = (await request.json()) as Record<string, unknown>;
  if (!body.name || !body.triggerType) {
    return NextResponse.json(
      { ok: false, error: "name and triggerType are required." },
      { status: 400 },
    );
  }
  const row = await createAutomation({
    actorId: actor.userId,
    organizationId: DEFAULT_ORG_ID,
    data: {
      name: String(body.name),
      description: body.description ? String(body.description) : "",
      category: body.category ? String(body.category) : "GENERAL",
      triggerType: String(body.triggerType),
      eventType: body.eventType ? String(body.eventType) : null,
      scheduleExpression: body.scheduleExpression
        ? String(body.scheduleExpression)
        : null,
      conditionsJson: body.conditionsJson
        ? String(body.conditionsJson)
        : JSON.stringify(body.conditions ?? { mode: "ALL", conditions: [] }),
      actionsJson: body.actionsJson
        ? String(body.actionsJson)
        : JSON.stringify(body.actions ?? []),
      approvalMode: body.approvalMode
        ? String(body.approvalMode)
        : "BEFORE_HIGH_IMPACT_ACTION",
      riskLevel: body.riskLevel ? String(body.riskLevel) : "LOW",
      dryRunEnabled: body.dryRunEnabled !== false,
      status: body.status ? String(body.status) : "DRAFT",
    },
  });
  return NextResponse.json({ ok: true, automation: row });
}
