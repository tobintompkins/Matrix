import { NextResponse } from "next/server";
import {
  forbidUnless,
  resolveMatrixAssistActor,
} from "@/lib/matrix-assist/auth";
import { getAiAssistantProvider } from "@/lib/matrix-assist/provider";
import {
  buildMatrixAssistContext,
} from "@/lib/matrix-assist/context-builder";
import { checkMatrixAssistRateLimit } from "@/lib/matrix-assist/rate-limit";
import {
  getDiagnosticSession,
  getOrCreateSettings,
  recordUsageEvent,
  writeAssistAudit,
} from "@/lib/matrix-assist/repository";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const started = Date.now();
  const actor = await resolveMatrixAssistActor();
  const denied = forbidUnless(actor, "USE_MATRIX_ASSIST");
  if (denied) return denied;

  const settings = await getOrCreateSettings(actor.organizationId);
  if (!settings.allowHistorySummaries) {
    return NextResponse.json(
      { ok: false, error: "Service-history summaries are disabled." },
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

  // Standalone / unlinked sessions: soft response — no error, no invented history
  if (!session.serviceCallId && !session.machineId) {
    return NextResponse.json({
      ok: true,
      summary: {
        bullets: [
          "Service history is available when Matrix Assist is linked to a valid service call or machine.",
        ],
        evidence: [],
        isSample: true,
      },
      mode: "standalone",
    });
  }

  const ctx = buildMatrixAssistContext({
    serviceCallId: session.serviceCallId,
    machineId: session.machineId,
    modelHint: session.modelHint,
    reportedSymptom: session.reportedSymptom,
  });

  const summary = await provider.summarizeServiceHistory({
    contextSummary: `${ctx.printerModel ?? ""} ${ctx.serialNumber ?? ""}`,
    records: ctx.recentServiceHistory,
  });

  await recordUsageEvent({
    organizationId: actor.organizationId,
    userId: actor.userId,
    eventType: "history_summary",
    durationMs: Date.now() - started,
  });
  await writeAssistAudit({
    organizationId: actor.organizationId,
    action: "matrix_assist.history_summary",
    entityId: id,
  });

  return NextResponse.json({ ok: true, summary });
}
