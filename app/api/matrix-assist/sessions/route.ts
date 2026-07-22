import { NextResponse } from "next/server";
import {
  forbidUnless,
  resolveMatrixAssistActor,
} from "@/lib/matrix-assist/auth";
import { getMatrixAssistPublicStatus } from "@/lib/matrix-assist/config";
import {
  assertCanAccessServiceCallContext,
  buildMatrixAssistContext,
  resolveServiceCallForAssist,
} from "@/lib/matrix-assist/context-builder";
import { checkMatrixAssistRateLimit } from "@/lib/matrix-assist/rate-limit";
import {
  createDiagnosticSession,
  getOrCreateSettings,
  writeAssistAudit,
} from "@/lib/matrix-assist/repository";
import { MAX_ASSIST_INPUT_LENGTH } from "@/lib/matrix-assist/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const actor = await resolveMatrixAssistActor();
  const denied = forbidUnless(actor, "USE_MATRIX_ASSIST");
  if (denied) return denied;

  const envStatus = getMatrixAssistPublicStatus();
  let settings;
  try {
    settings = await getOrCreateSettings(actor.organizationId);
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Matrix Assist storage is unavailable. Apply the Patch 48 migration, then retry.",
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 503 },
    );
  }
  if (!envStatus.enabled || !settings.enabled) {
    return NextResponse.json(
      { ok: false, error: "Matrix Assist is disabled in this environment." },
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

  const body = (await request.json().catch(() => ({}))) as {
    serviceCallId?: string;
    machineId?: string;
    reportedSymptom?: string;
    technicianObservations?: string;
    modelHint?: string;
    errorCode?: string;
  };

  const access = assertCanAccessServiceCallContext({
    roleCanViewAll: actor.canViewAllServiceCalls,
    actorDisplayName: actor.displayName,
    serviceCallId: body.serviceCallId,
  });
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: 403 });
  }

  // Resolve linked call when present; unknown IDs soft-fall through to Standalone Mode
  const resolvedCall = resolveServiceCallForAssist(body.serviceCallId);
  const effectiveServiceCallId = resolvedCall?.id;
  const machineId = body.machineId?.trim() || undefined;
  const modelHint = body.modelHint?.trim() || undefined;
  const reportedSymptom = body.reportedSymptom?.trim() || undefined;
  const technicianObservations = body.technicianObservations?.trim() || undefined;

  const standaloneReady = Boolean(modelHint || reportedSymptom);
  if (!effectiveServiceCallId && !machineId && !standaloneReady) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Enter a machine model and symptom for Standalone Mode, or link a service call / machine.",
      },
      { status: 400 },
    );
  }

  const ctx = buildMatrixAssistContext({
    serviceCallId: effectiveServiceCallId,
    machineId,
    technicianObservations,
    modelHint,
    reportedSymptom,
  });

  const session = await createDiagnosticSession({
    organizationId: actor.organizationId,
    serviceCallId: ctx.serviceCallId ?? null,
    machineId: ctx.machineId ?? machineId ?? null,
    technicianId: actor.userId,
    technicianName: actor.displayName,
    reportedSymptom: (reportedSymptom ?? ctx.reportedIssue ?? "").slice(
      0,
      MAX_ASSIST_INPUT_LENGTH,
    ),
    technicianObservations: (technicianObservations ?? "").slice(
      0,
      MAX_ASSIST_INPUT_LENGTH,
    ),
    modelHint: modelHint ?? ctx.printerModel ?? undefined,
    errorCode: body.errorCode ?? undefined,
  });

  await writeAssistAudit({
    organizationId: actor.organizationId,
    action: "matrix_assist.session_created",
    entityId: session.id,
    payload: {
      serviceCallId: session.serviceCallId,
      machineId: session.machineId,
      standalone: !session.serviceCallId && !session.machineId,
    },
  });

  return NextResponse.json({
    ok: true,
    session,
    context: ctx,
    mode: ctx.serviceCallId || ctx.machineId ? "linked" : "standalone",
  });
}
