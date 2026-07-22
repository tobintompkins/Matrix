import { NextResponse } from "next/server";
import { forbidUnlessAi, resolveAiActor } from "@/lib/ai/auth";
import { postUserMessage } from "@/lib/ai/assistant/conversations";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "USE_AI_ASSISTANT");
  if (denied) return denied;
  const body = (await request.json()) as {
    conversationId?: string;
    question?: string;
    selectedValue?: string;
  };
  if (!body.conversationId || !body.question || !body.selectedValue) {
    return NextResponse.json(
      { ok: false, error: "conversationId, question, and selectedValue are required." },
      { status: 400 },
    );
  }
  const result = await postUserMessage({
    conversationId: body.conversationId,
    actor: {
      userId: actor.userId,
      displayName: actor.displayName,
      role: actor.role,
      organizationId: DEFAULT_ORG_ID,
    },
    question: body.question,
    clarificationValue: body.selectedValue,
  });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, answer: result.answer, messageId: result.messageId });
}
