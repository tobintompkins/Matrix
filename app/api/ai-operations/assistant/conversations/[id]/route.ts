import { NextResponse } from "next/server";
import { forbidUnlessAi, resolveAiActor } from "@/lib/ai/auth";
import {
  deleteConversation,
  getConversation,
  updateConversation,
} from "@/lib/ai/assistant/conversations";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

function actorFrom(a: Awaited<ReturnType<typeof resolveAiActor>>) {
  return {
    userId: a.userId,
    displayName: a.displayName,
    role: a.role,
    organizationId: DEFAULT_ORG_ID,
  };
}

export async function GET(_request: Request, ctx: Ctx) {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "VIEW_AI_CONVERSATIONS");
  if (denied) return denied;
  const { id } = await ctx.params;
  const conversation = await getConversation(id, actorFrom(actor));
  if (!conversation) {
    return NextResponse.json({ ok: false, error: "Conversation not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, conversation });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "MANAGE_OWN_AI_CONVERSATIONS");
  if (denied) return denied;
  const { id } = await ctx.params;
  const body = (await request.json()) as {
    title?: string;
    status?: "ACTIVE" | "ARCHIVED";
  };
  const result = await updateConversation(id, actorFrom(actor), body);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, conversation: result.conversation });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const actor = await resolveAiActor();
  const deniedDelete = forbidUnlessAi(actor, "DELETE_AI_CONVERSATIONS");
  const deniedOwn = forbidUnlessAi(actor, "MANAGE_OWN_AI_CONVERSATIONS");
  if (deniedDelete && deniedOwn) return deniedDelete;
  const { id } = await ctx.params;
  const result = await deleteConversation(id, actorFrom(actor));
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
