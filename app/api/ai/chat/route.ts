import { NextResponse } from "next/server";
import { forbidUnlessAi, resolveAiActor, ensureAiCenterSeeded } from "@/lib/ai";
import { aiEngine } from "@/services/ai";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "VIEW_AI_CENTER");
  if (denied) return denied;
  try {
    await ensureAiCenterSeeded();
    const body = (await request.json()) as {
      question?: string;
      sessionId?: string | null;
    };
    const question = body.question?.trim() ?? "";
    if (!question) {
      return NextResponse.json(
        { ok: false, error: "Question is required." },
        { status: 400 },
      );
    }
    const result = await aiEngine.chat({
      question,
      sessionId: body.sessionId,
      userId: actor.userId,
    });
    return NextResponse.json({
      success: true,
      answer: result.answer,
      confidence: result.confidence,
      sessionId: result.sessionId,
      executionTimeMs: result.executionTimeMs,
      placeholder: true,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Failed." },
      { status: 500 },
    );
  }
}
