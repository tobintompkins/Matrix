import { NextResponse } from "next/server";
import {
  forbidUnless,
  resolveMatrixAssistActor,
} from "@/lib/matrix-assist/auth";
import { getAiAssistantProvider } from "@/lib/matrix-assist/provider";
import { checkMatrixAssistRateLimit } from "@/lib/matrix-assist/rate-limit";
import {
  getDiagnosticSession,
  getOrCreateSettings,
  recordUsageEvent,
  writeAssistAudit,
} from "@/lib/matrix-assist/repository";
import { MAX_ASSIST_INPUT_LENGTH } from "@/lib/matrix-assist/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const started = Date.now();
  const actor = await resolveMatrixAssistActor();
  const denied = forbidUnless(actor, "USE_MATRIX_ASSIST");
  if (denied) return denied;

  const settings = await getOrCreateSettings(actor.organizationId);
  if (!settings.allowServiceNoteDrafts) {
    return NextResponse.json(
      { ok: false, error: "Service-note drafts are disabled." },
      { status: 403 },
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

  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    string | undefined
  >;
  const trim = (v?: string) => (v ?? "").slice(0, MAX_ASSIST_INPUT_LENGTH);

  const draft = await provider.draftServiceNotes({
    customerComplaint: trim(body.customerComplaint ?? session.reportedSymptom ?? undefined),
    inspection: trim(body.inspection ?? session.technicianObservations ?? undefined),
    tests: trim(body.tests),
    partsCleaned: trim(body.partsCleaned),
    partsReplaced: trim(body.partsReplaced),
    adjustments: trim(body.adjustments),
    finalResult: trim(body.finalResult),
    followUp: trim(body.followUp),
    machineStatus: trim(body.machineStatus),
  });

  await recordUsageEvent({
    organizationId: actor.organizationId,
    userId: actor.userId,
    eventType: "draft_notes",
    durationMs: Date.now() - started,
  });
  await writeAssistAudit({
    organizationId: actor.organizationId,
    action: "matrix_assist.draft_notes",
    entityId: id,
  });

  return NextResponse.json({
    ok: true,
    draft,
    approvalRequired: true,
    notice:
      "AI-generated draft — review before saving. This does not overwrite existing service notes.",
  });
}
