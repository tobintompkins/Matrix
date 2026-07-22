import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { addApprovalComment, listApprovalComments } from "@/lib/approvals";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "VIEW_APPROVAL_CENTER");
  if (denied) return denied;
  const { id } = await context.params;

  try {
    const items = await listApprovalComments(actor, id);
    return NextResponse.json({ ok: true, items });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Load failed." },
      { status: 400 },
    );
  }
}

export async function POST(request: Request, context: Ctx) {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "COMMENT_ON_APPROVAL");
  if (denied) return denied;
  const { id } = await context.params;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const item = await addApprovalComment({
      actor,
      approvalRequestId: id,
      body: String(body.body ?? ""),
      parentCommentId: (body.parentCommentId as string) ?? null,
      isInternal: Boolean(body.isInternal),
    });
    return NextResponse.json({ ok: true, item }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Comment failed." },
      { status: 400 },
    );
  }
}
