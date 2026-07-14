import { NextResponse } from "next/server";
import {
  forbidUnless,
  resolveMatrixAssistActor,
} from "@/lib/matrix-assist/auth";
import {
  addFeedback,
  getDiagnosticSession,
  recordUsageEvent,
  writeAssistAudit,
} from "@/lib/matrix-assist/repository";
import type { FeedbackRating } from "@/lib/matrix-assist/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const RATINGS: FeedbackRating[] = [
  "HELPFUL",
  "NOT_HELPFUL",
  "PARTIALLY_HELPFUL",
];

export async function POST(request: Request, { params }: Params) {
  const actor = await resolveMatrixAssistActor();
  const denied = forbidUnless(actor, "USE_MATRIX_ASSIST");
  if (denied) return denied;

  const { id } = await params;
  const session = await getDiagnosticSession(id);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Session not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    rating?: string;
    reason?: string;
    comment?: string;
    messageId?: string;
  };

  if (!body.rating || !RATINGS.includes(body.rating as FeedbackRating)) {
    return NextResponse.json(
      { ok: false, error: "Invalid feedback rating." },
      { status: 400 },
    );
  }

  const feedback = await addFeedback({
    organizationId: actor.organizationId,
    diagnosticSessionId: id,
    messageId: body.messageId,
    userId: actor.userId,
    rating: body.rating as FeedbackRating,
    reason: body.reason,
    comment: body.comment,
  });

  await recordUsageEvent({
    organizationId: actor.organizationId,
    userId: actor.userId,
    eventType: "feedback",
  });
  await writeAssistAudit({
    organizationId: actor.organizationId,
    action: "matrix_assist.feedback",
    entityId: id,
    payload: { rating: body.rating, reason: body.reason ?? null },
  });

  return NextResponse.json({ ok: true, feedback });
}
