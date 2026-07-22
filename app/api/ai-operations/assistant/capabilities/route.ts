import { NextResponse } from "next/server";
import { forbidUnlessAi, resolveAiActor } from "@/lib/ai/auth";
import { ASSISTANT_CAPABILITIES } from "@/lib/ai/assistant/intent";
import { ADVISORY_ASSISTANT } from "@/lib/ai/assistant/types";
import { aiConfig } from "@/config/ai";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "VIEW_AI_ASSISTANT");
  if (denied) return denied;
  return NextResponse.json({
    ok: true,
    capabilities: {
      ...ASSISTANT_CAPABILITIES,
      advisoryNotice: ADVISORY_ASSISTANT,
      assistantEnabled: aiConfig.assistantEnabled,
      assistantVersion: aiConfig.assistantVersion,
      maxQuestionLength: aiConfig.assistantMaxQuestionLength,
      maxResults: aiConfig.assistantMaxResults,
      providerConfigured: false,
      mode: "deterministic-matrix-search",
    },
  });
}
