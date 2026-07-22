import { NextResponse } from "next/server";
import { forbidUnlessAi, resolveAiActor } from "@/lib/ai/auth";
import { submitFeedback } from "@/lib/ai/assistant/conversations";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "USE_AI_ASSISTANT");
  if (denied) return denied;
  const body = (await request.json()) as {
    conversationId?: string;
    messageId?: string;
    rating?: string;
    comment?: string;
  };
  if (!body.conversationId || !body.messageId || !body.rating) {
    return NextResponse.json(
      { ok: false, error: "conversationId, messageId, and rating are required." },
      { status: 400 },
    );
  }
  const result = await submitFeedback({
    actor: {
      userId: actor.userId,
      displayName: actor.displayName,
      role: actor.role,
      organizationId: DEFAULT_ORG_ID,
    },
    conversationId: body.conversationId,
    messageId: body.messageId,
    rating: body.rating,
    comment: body.comment,
  });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
