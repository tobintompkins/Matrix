import { NextResponse } from "next/server";
import {
  forbidUnless,
  resolveMatrixAssistActor,
} from "@/lib/matrix-assist/auth";
import {
  getDiagnosticSession,
  updateStepResult,
} from "@/lib/matrix-assist/repository";
import type { StepResult } from "@/lib/matrix-assist/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const RESULTS: StepResult[] = [
  "NOT_STARTED",
  "PASSED",
  "FAILED",
  "NOT_APPLICABLE",
];

export async function PATCH(request: Request, { params }: Params) {
  const actor = await resolveMatrixAssistActor();
  const denied = forbidUnless(actor, "USE_MATRIX_ASSIST");
  if (denied) return denied;

  const { id } = await params;
  const session = await getDiagnosticSession(id);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Session not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    stepId?: string;
    result?: string;
    technicianNote?: string;
  };

  if (!body.stepId || !body.result || !RESULTS.includes(body.result as StepResult)) {
    return NextResponse.json(
      { ok: false, error: "stepId and valid result are required." },
      { status: 400 },
    );
  }

  const ownsStep = session.steps.some((s) => s.id === body.stepId);
  if (!ownsStep) {
    return NextResponse.json({ ok: false, error: "Step not found." }, { status: 404 });
  }

  const step = await updateStepResult({
    stepId: body.stepId,
    result: body.result as StepResult,
    technicianNote: body.technicianNote,
  });

  return NextResponse.json({ ok: true, step });
}
