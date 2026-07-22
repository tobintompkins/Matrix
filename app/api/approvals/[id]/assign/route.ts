import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { assignReviewer } from "@/lib/approvals";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "ASSIGN_APPROVAL_REVIEWER");
  if (denied) return denied;
  const { id } = await context.params;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const item = await assignReviewer({
      id,
      actor,
      assigneeUserId: String(body.assigneeUserId ?? ""),
      assigneeName: (body.assigneeName as string) ?? null,
      reason: (body.reason as string) ?? null,
    });
    return NextResponse.json({ ok: true, item });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Assign failed." },
      { status: 400 },
    );
  }
}
