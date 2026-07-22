import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { archiveApprovalRequest } from "@/lib/approvals";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: Ctx) {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "ARCHIVE_APPROVALS");
  if (denied) return denied;
  const { id } = await context.params;

  try {
    const item = await archiveApprovalRequest(actor, id);
    return NextResponse.json({ ok: true, item });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Archive failed." },
      { status: 400 },
    );
  }
}
