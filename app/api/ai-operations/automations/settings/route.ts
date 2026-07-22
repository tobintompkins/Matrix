import { NextResponse } from "next/server";
import { forbidUnlessAi, resolveAiActor } from "@/lib/ai/auth";
import { getOrCreateSettings } from "@/lib/automations/engine/execute-automation";
import { prisma } from "@/lib/db/prisma";
import { writeAdminAudit } from "@/lib/admin/repository";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import { AUTOMATION_TRIGGERS } from "@/lib/automations/registry/triggers";
import { AUTOMATION_ACTIONS } from "@/lib/automations/registry/actions";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "VIEW_AI_AUTOMATIONS");
  if (denied) return denied;
  const settings = await getOrCreateSettings(DEFAULT_ORG_ID);
  return NextResponse.json({
    ok: true,
    settings,
    triggers: AUTOMATION_TRIGGERS,
    actions: AUTOMATION_ACTIONS,
  });
}

export async function PATCH(request: Request) {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "MANAGE_AI_AUTOMATION_SETTINGS");
  if (denied) return denied;
  const body = (await request.json()) as Record<string, unknown>;
  const settings = await getOrCreateSettings(DEFAULT_ORG_ID);
  const updated = await prisma.aiOpsAutomationSetting.update({
    where: { id: settings.id },
    data: {
      automationEnabled:
        typeof body.automationEnabled === "boolean"
          ? body.automationEnabled
          : undefined,
      allowAiConditions:
        typeof body.allowAiConditions === "boolean"
          ? body.allowAiConditions
          : undefined,
      defaultApprovalMode: body.defaultApprovalMode
        ? String(body.defaultApprovalMode)
        : undefined,
      highImpactActionsRequireApproval:
        typeof body.highImpactActionsRequireApproval === "boolean"
          ? body.highImpactActionsRequireApproval
          : undefined,
      maxConcurrentRuns:
        typeof body.maxConcurrentRuns === "number"
          ? body.maxConcurrentRuns
          : undefined,
      autoPauseFailureThreshold:
        typeof body.autoPauseFailureThreshold === "number"
          ? body.autoPauseFailureThreshold
          : undefined,
    },
  });
  await writeAdminAudit({
    organizationId: DEFAULT_ORG_ID,
    actorId: actor.userId,
    action: "AI_AUTOMATION_SETTINGS_UPDATED",
    entityType: "AiOpsAutomationSetting",
    entityId: updated.id,
    payload: body,
    category: "SYSTEM",
    severity: "INFO",
    outcome: "SUCCESS",
  });
  return NextResponse.json({ ok: true, settings: updated });
}
