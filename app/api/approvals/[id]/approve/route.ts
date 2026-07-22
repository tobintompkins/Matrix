import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { approveRequest } from "@/lib/approvals";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "APPROVE_REQUEST");
  if (denied) return denied;
  const { id } = await context.params;

  try {
    let comment: string | null = null;
    try {
      const body = (await request.json()) as Record<string, unknown>;
      comment = (body.comment as string) ?? null;
    } catch {
      /* empty ok */
    }
    const item = await approveRequest({ id, actor, comment });
    return NextResponse.json({ ok: true, item });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Approve failed." },
      { status: 400 },
    );
  }
}
