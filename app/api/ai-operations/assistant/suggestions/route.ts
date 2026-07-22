import { NextResponse } from "next/server";
import { forbidUnlessAi, resolveAiActor } from "@/lib/ai/auth";
import { getSuggestions } from "@/lib/ai/assistant/conversations";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "VIEW_AI_ASSISTANT");
  if (denied) return denied;
  return NextResponse.json({ ok: true, suggestions: getSuggestions() });
}
