import { NextResponse } from "next/server";
import { forbidUnlessAi, resolveAiActor } from "@/lib/ai/auth";
import { listMessages, postUserMessage } from "@/lib/ai/assistant/conversations";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "VIEW_AI_CONVERSATIONS");
  if (denied) return denied;
  const { id } = await ctx.params;
  const messages = await listMessages(id, {
    userId: actor.userId,
    displayName: actor.displayName,
    role: actor.role,
    organizationId: DEFAULT_ORG_ID,
  });
  if (!messages) {
    return NextResponse.json({ ok: false, error: "Conversation not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, items: messages });
}

export async function POST(request: Request, ctx: Ctx) {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "USE_AI_ASSISTANT");
  if (denied) return denied;
  const { id } = await ctx.params;
  const body = (await request.json()) as {
    question?: string;
    clarificationValue?: string;
  };
  if (!body.question?.trim()) {
    return NextResponse.json({ ok: false, error: "question is required." }, { status: 400 });
  }
  const result = await postUserMessage({
    conversationId: id,
    actor: {
      userId: actor.userId,
      displayName: actor.displayName,
      role: actor.role,
      organizationId: DEFAULT_ORG_ID,
    },
    question: body.question,
    clarificationValue: body.clarificationValue,
  });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({
    ok: true,
    answer: result.answer,
    messageId: result.messageId,
    sources: result.sources,
  });
}
