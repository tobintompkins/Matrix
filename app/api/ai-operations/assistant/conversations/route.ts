import { NextResponse } from "next/server";
import { forbidUnlessAi, resolveAiActor } from "@/lib/ai/auth";
import {
  createConversation,
  listConversations,
} from "@/lib/ai/assistant/conversations";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "VIEW_AI_CONVERSATIONS");
  if (denied) return denied;
  const url = new URL(request.url);
  const result = await listConversations({
    actor: {
      userId: actor.userId,
      displayName: actor.displayName,
      role: actor.role,
      organizationId: DEFAULT_ORG_ID,
    },
    status: url.searchParams.get("status") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
    page: Number(url.searchParams.get("page") ?? "1"),
    pageSize: Number(url.searchParams.get("pageSize") ?? "20"),
  });
  return NextResponse.json({ ok: true, ...result });
}

export async function POST(request: Request) {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "USE_AI_ASSISTANT");
  if (denied) return denied;
  const body = (await request.json().catch(() => ({}))) as { title?: string };
  const conversation = await createConversation(
    {
      userId: actor.userId,
      displayName: actor.displayName,
      role: actor.role,
      organizationId: DEFAULT_ORG_ID,
    },
    body.title,
  );
  return NextResponse.json({ ok: true, conversation });
}
