import { NextResponse } from "next/server";
import {
  forbidUnless,
  resolveMatrixAssistActor,
} from "@/lib/matrix-assist/auth";
import {
  getOrCreateSettings,
  updateSettings,
  writeAssistAudit,
  listTemplates,
} from "@/lib/matrix-assist/repository";
import { getMatrixAssistPublicStatus } from "@/lib/matrix-assist/config";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await resolveMatrixAssistActor();
  const denied = forbidUnless(actor, "MANAGE_MATRIX_ASSIST_SETTINGS");
  if (denied) {
    const viewDenied = forbidUnless(actor, "VIEW_AI_USAGE");
    if (viewDenied) return viewDenied;
  }

  const settings = await getOrCreateSettings(actor.organizationId);
  const env = getMatrixAssistPublicStatus();
  const usage = actor.canManageSettings || !denied
    ? await prisma.matrixAssistUsageEvent.groupBy({
        by: ["eventType"],
        _count: { _all: true },
      }).catch(() => [])
    : [];

  const templates = await listTemplates(false).catch(() => []);

  return NextResponse.json({
    ok: true,
    settings,
    env,
    usage,
    templates: templates.map((t) => ({
      id: t.id,
      title: t.title,
      symptomCategory: t.symptomCategory,
      printerModel: t.printerModel,
      active: t.active,
      version: t.version,
    })),
  });
}

export async function PATCH(request: Request) {
  const actor = await resolveMatrixAssistActor();
  const denied = forbidUnless(actor, "MANAGE_MATRIX_ASSIST_SETTINGS");
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  const updated = await updateSettings(actor.organizationId, {
    enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
    allowHistorySummaries:
      typeof body.allowHistorySummaries === "boolean"
        ? body.allowHistorySummaries
        : undefined,
    allowPartsSuggestions:
      typeof body.allowPartsSuggestions === "boolean"
        ? body.allowPartsSuggestions
        : undefined,
    allowServiceNoteDrafts:
      typeof body.allowServiceNoteDrafts === "boolean"
        ? body.allowServiceNoteDrafts
        : undefined,
    allowTroubleshootingTemplates:
      typeof body.allowTroubleshootingTemplates === "boolean"
        ? body.allowTroubleshootingTemplates
        : undefined,
    requireFeedbackOnComplete:
      typeof body.requireFeedbackOnComplete === "boolean"
        ? body.requireFeedbackOnComplete
        : undefined,
    maxResponseLength:
      typeof body.maxResponseLength === "number"
        ? body.maxResponseLength
        : undefined,
    conversationRetentionDays:
      typeof body.conversationRetentionDays === "number"
        ? body.conversationRetentionDays
        : undefined,
    approvedModel:
      typeof body.approvedModel === "string" ? body.approvedModel : undefined,
    disclaimerOverride:
      typeof body.disclaimerOverride === "string"
        ? body.disclaimerOverride
        : undefined,
    updatedBy: actor.displayName,
  });

  await writeAssistAudit({
    organizationId: actor.organizationId,
    action: "matrix_assist.settings_changed",
    entityId: updated.id,
    payload: { keys: Object.keys(body) },
  });

  return NextResponse.json({
    ok: true,
    settings: updated,
    notice: "API keys are not stored or returned by this endpoint.",
  });
}
