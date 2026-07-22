import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { cancelApprovalRequest } from "@/lib/approvals";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "CANCEL_APPROVAL");
  if (denied) return denied;
  const { id } = await context.params;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const item = await cancelApprovalRequest(
      actor,
      id,
      String(body.reason ?? ""),
    );
    return NextResponse.json({ ok: true, item });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Cancel failed." },
      { status: 400 },
    );
  }
}
