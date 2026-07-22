import { NextResponse } from "next/server";
import { forbidUnlessAi, resolveAiActor } from "@/lib/ai/auth";
import {
  createConversation,
  postUserMessage,
} from "@/lib/ai/assistant/conversations";
import { runAssistantQuery } from "@/lib/ai/assistant/pipeline";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";

export const dynamic = "force-dynamic";

/** One-shot or conversation-backed query. */
export async function POST(request: Request) {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "USE_AI_ASSISTANT");
  if (denied) return denied;
  const body = (await request.json()) as {
    question?: string;
    conversationId?: string;
    clarificationValue?: string;
    persist?: boolean;
  };
  if (!body.question?.trim()) {
    return NextResponse.json({ ok: false, error: "question is required." }, { status: 400 });
  }

  const convoActor = {
    userId: actor.userId,
    displayName: actor.displayName,
    role: actor.role,
    organizationId: DEFAULT_ORG_ID,
  };

  if (body.persist !== false) {
    let conversationId = body.conversationId;
    if (!conversationId) {
      const c = await createConversation(convoActor);
      conversationId = c.id;
    }
    const result = await postUserMessage({
      conversationId,
      actor: convoActor,
      question: body.question,
      clarificationValue: body.clarificationValue,
    });
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      conversationId,
      answer: result.answer,
      messageId: result.messageId,
    });
  }

  const answer = await runAssistantQuery({
    actor: {
      userId: actor.userId,
      displayName: actor.displayName,
      role: actor.role,
      organizationId: DEFAULT_ORG_ID,
    },
    question: body.question,
    clarificationValue: body.clarificationValue,
  });
  return NextResponse.json({ ok: true, answer });
}
