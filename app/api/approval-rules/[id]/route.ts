import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { writeAdminAudit } from "@/lib/admin/repository";
import type { RuleConditions, WorkflowDefinition } from "@/lib/approvals";
import { updateApprovalRule } from "@/lib/approvals";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Ctx) {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "MANAGE_APPROVAL_RULES");
  if (denied) return denied;
  const { id } = await context.params;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const item = await updateApprovalRule({
      id,
      organizationId: actor.organizationId,
      name: body.name as string | undefined,
      description: body.description as string | null | undefined,
      approvalType: body.approvalType as string | undefined,
      sourceModule: body.sourceModule as string | null | undefined,
      priority: body.priority == null ? undefined : Number(body.priority),
      conditions: body.conditions as RuleConditions | undefined,
      workflow: body.workflow as WorkflowDefinition | undefined,
      actorUserId: actor.userId,
    });
    await writeAdminAudit({
      organizationId: actor.organizationId,
      actorId: actor.userId,
      action: "APPROVAL_RULE_UPDATED",
      entityType: "ApprovalRule",
      entityId: item.id,
      payload: { name: item.name },
    });
    return NextResponse.json({ ok: true, item });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Update failed." },
      { status: 400 },
    );
  }
}
