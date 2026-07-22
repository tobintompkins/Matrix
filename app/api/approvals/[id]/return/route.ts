import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { returnForRevision } from "@/lib/approvals";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "RETURN_APPROVAL_FOR_REVISION");
  if (denied) return denied;
  const { id } = await context.params;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const item = await returnForRevision({
      id,
      actor,
      instructions: String(body.instructions ?? body.reason ?? ""),
    });
    return NextResponse.json({ ok: true, item });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Return failed." },
      { status: 400 },
    );
  }
}
