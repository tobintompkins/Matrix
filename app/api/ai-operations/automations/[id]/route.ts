import { NextResponse } from "next/server";
import { forbidUnlessAi, resolveAiActor } from "@/lib/ai/auth";
import {
  duplicateAutomation,
  getAutomation,
  updateAutomation,
} from "@/lib/automations/service";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "VIEW_AI_AUTOMATIONS");
  if (denied) return denied;
  const { id } = await ctx.params;
  const automation = await getAutomation(id, DEFAULT_ORG_ID);
  if (!automation) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, automation });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "EDIT_AI_AUTOMATIONS");
  if (denied) return denied;
  const { id } = await ctx.params;
  const body = (await request.json()) as Record<string, unknown>;
  if (body.action === "duplicate") {
    const copy = await duplicateAutomation(id, actor.userId, DEFAULT_ORG_ID);
    if (!copy) {
      return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, automation: copy });
  }
  if (body.status === "ACTIVE") {
    const enableDenied = forbidUnlessAi(actor, "ENABLE_AI_AUTOMATIONS");
    if (enableDenied) return enableDenied;
  }
  const row = await updateAutomation({
    id,
    actorId: actor.userId,
    organizationId: DEFAULT_ORG_ID,
    data: body,
  });
  if (!row) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, automation: row });
}
