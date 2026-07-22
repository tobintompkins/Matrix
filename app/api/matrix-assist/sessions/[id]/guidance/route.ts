import { NextResponse } from "next/server";
import {
  forbidUnless,
  resolveMatrixAssistActor,
} from "@/lib/matrix-assist/auth";
import { getMatrixAssistPublicStatus } from "@/lib/matrix-assist/config";
import {
  assertCanAccessServiceCallContext,
  buildMatrixAssistContext,
  contextToProviderSummary,
} from "@/lib/matrix-assist/context-builder";
import { getAiAssistantProvider } from "@/lib/matrix-assist/provider";
import { suggestPartsForSymptom } from "@/lib/matrix-assist/parts";
import { checkMatrixAssistRateLimit } from "@/lib/matrix-assist/rate-limit";
import {
  addMessage,
  getDiagnosticSession,
  getOrCreateSettings,
  recordUsageEvent,
  replaceInspectionSteps,
  saveSuggestedCauses,
  writeAssistAudit,
} from "@/lib/matrix-assist/repository";
import { matchTemplates } from "@/lib/matrix-assist/templates";
import { MAX_ASSIST_INPUT_LENGTH } from "@/lib/matrix-assist/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const started = Date.now();
  const actor = await resolveMatrixAssistActor();
  const denied = forbidUnless(actor, "USE_MATRIX_ASSIST");
  if (denied) return denied;

  const envStatus = getMatrixAssistPublicStatus();
  if (!envStatus.enabled) {
    return NextResponse.json(
      { ok: false, error: "Matrix Assist is disabled in this environment." },
      { status: 503 },
    );
  }

  const provider = getAiAssistantProvider();
  if (!provider) {
    return NextResponse.json(
      {
        ok: false,
        error: "Matrix Assist is not configured in this environment.",
      },
      { status: 503 },
    );
  }

  const rate = checkMatrixAssistRateLimit({
    userId: actor.userId,
    organizationId: actor.organizationId,
  });
  if (!rate.ok) {
    return NextResponse.json({ ok: false, error: rate.message }, { status: 429 });
  }

  const { id } = await params;
  const session = await getDiagnosticSession(id);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Session not found." }, { status: 404 });
  }
  if (
    !actor.canViewTeamSessions &&
    session.technicianId &&
    session.technicianId !== actor.userId
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "You do not have permission to use Matrix Assist for this record.",
      },
      { status: 403 },
    );
  }

  const access = assertCanAccessServiceCallContext({
    roleCanViewAll: actor.canViewAllServiceCalls,
    actorDisplayName: actor.displayName,
    serviceCallId: session.serviceCallId,
  });
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    symptom?: string;
    observations?: string;
    symptomCategory?: string;
  };

  const symptom = (
    body.symptom ??
    session.reportedSymptom ??
    ""
  ).slice(0, MAX_ASSIST_INPUT_LENGTH);
  if (!symptom.trim()) {
    return NextResponse.json(
      {
        ok: false,
        error: "Describe the issue to begin a guided diagnostic session.",
      },
      { status: 400 },
    );
  }

  const ctx = buildMatrixAssistContext({
    serviceCallId: session.serviceCallId,
    machineId: session.machineId,
    technicianObservations:
      body.observations ?? session.technicianObservations,
    modelHint: session.modelHint,
    reportedSymptom: session.reportedSymptom,
  });

  const templates = matchTemplates({
    symptomCategory: body.symptomCategory,
    printerModel: session.modelHint ?? ctx.printerModel,
    errorCode: session.errorCode,
  });
  const primary = templates[0];
  const hasVerifiedModelProcedure = Boolean(
    primary?.printerModel &&
      (session.modelHint ?? ctx.printerModel) &&
      primary.printerModel.toLowerCase() ===
        (session.modelHint ?? ctx.printerModel ?? "").toLowerCase() &&
      // Seeded templates are generic — never claim official manufacturer docs.
      false,
  );

  const evidence: import("@/lib/matrix-assist/types").EvidenceRef[] =
    ctx.recentServiceHistory.map((r) => ({
      label: `Service Call ${r.label}`,
      href: r.href,
      kind: "service_call" as const,
    }));
  if (evidence.length === 0) {
    evidence.push({
      label: "Based on the current technician observation only.",
      kind: "observation",
    });
  }

  const guidance = await provider.generateDiagnosticGuidance({
    symptom,
    observations: body.observations ?? session.technicianObservations ?? undefined,
    modelHint: session.modelHint ?? ctx.printerModel,
    errorCode: session.errorCode ?? undefined,
    contextSummary: contextToProviderSummary(ctx),
    evidence,
    templateSteps: primary?.steps,
    hasVerifiedModelProcedure,
  });

  const steps = await replaceInspectionSteps(id, guidance.inspectionChecks);
  await saveSuggestedCauses(
    id,
    JSON.stringify(guidance.likelyCauses),
    guidance.summary,
  );
  await addMessage({
    organizationId: actor.organizationId,
    diagnosticSessionId: id,
    serviceCallId: session.serviceCallId,
    machineId: session.machineId,
    userId: actor.userId,
    role: "USER",
    content: symptom,
  });
  const assistantMessage = await addMessage({
    organizationId: actor.organizationId,
    diagnosticSessionId: id,
    serviceCallId: session.serviceCallId,
    machineId: session.machineId,
    userId: actor.userId,
    role: "ASSISTANT",
    content: guidance.summary,
  });

  let parts: ReturnType<typeof suggestPartsForSymptom> = [];
  try {
    const settings = await getOrCreateSettings(actor.organizationId);
    if (settings.allowPartsSuggestions) {
      parts = suggestPartsForSymptom({
        symptomCategory: body.symptomCategory ?? primary?.symptomCategory,
        printerModel: session.modelHint ?? ctx.printerModel,
        errorCode: session.errorCode,
        canViewInventory: actor.canViewInventory,
      });
    }
  } catch {
    parts = [];
  }

  await recordUsageEvent({
    organizationId: actor.organizationId,
    userId: actor.userId,
    eventType: "guidance",
    durationMs: Date.now() - started,
  });
  await writeAssistAudit({
    organizationId: actor.organizationId,
    action: "matrix_assist.guidance_requested",
    entityId: id,
    payload: { sample: guidance.isSample },
  });

  return NextResponse.json({
    ok: true,
    guidance,
    steps,
    parts,
    messageId: assistantMessage.id,
    followUps: [
      { type: "Schedule follow-up visit", requiresConfirmation: true },
      { type: "Create parts request", requiresConfirmation: true, href: "/order-parts" },
      { type: "Record meter", requiresConfirmation: true, href: "/maintenance/counts" },
      { type: "Escalate to senior technician", requiresConfirmation: true },
      { type: "Monitor machine", requiresConfirmation: true },
    ],
  });
}
