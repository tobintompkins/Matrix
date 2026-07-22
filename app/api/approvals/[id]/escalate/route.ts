import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { escalateRequest } from "@/lib/approvals";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "ESCALATE_APPROVAL");
  if (denied) return denied;
  const { id } = await context.params;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const item = await escalateRequest({
      id,
      actor,
      reason: String(body.reason ?? ""),
      escalateToUserId: String(body.escalateToUserId ?? ""),
      escalateToName: (body.escalateToName as string) ?? null,
    });
    return NextResponse.json({ ok: true, item });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Escalate failed." },
      { status: 400 },
    );
  }
}
