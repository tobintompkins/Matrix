import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { writeAdminAudit } from "@/lib/admin/repository";
import { setApprovalRuleActive } from "@/lib/approvals";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: Ctx) {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "MANAGE_APPROVAL_RULES");
  if (denied) return denied;
  const { id } = await context.params;

  try {
    const item = await setApprovalRuleActive({
      id,
      organizationId: actor.organizationId,
      isActive: false,
      actorUserId: actor.userId,
    });
    await writeAdminAudit({
      organizationId: actor.organizationId,
      actorId: actor.userId,
      action: "APPROVAL_RULE_DEACTIVATED",
      entityType: "ApprovalRule",
      entityId: item.id,
    });
    return NextResponse.json({ ok: true, item });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Deactivate failed.",
      },
      { status: 400 },
    );
  }
}
