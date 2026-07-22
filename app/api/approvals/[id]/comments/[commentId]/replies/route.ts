import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { addApprovalComment } from "@/lib/approvals";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; commentId: string }> };

export async function POST(request: Request, context: Ctx) {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "COMMENT_ON_APPROVAL");
  if (denied) return denied;
  const { id, commentId } = await context.params;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const item = await addApprovalComment({
      actor,
      approvalRequestId: id,
      body: String(body.body ?? ""),
      parentCommentId: commentId,
      isInternal: Boolean(body.isInternal),
    });
    return NextResponse.json({ ok: true, item }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Reply failed." },
      { status: 400 },
    );
  }
}
