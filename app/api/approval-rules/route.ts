import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { writeAdminAudit } from "@/lib/admin/repository";
import type { RuleConditions, WorkflowDefinition } from "@/lib/approvals";
import {
  createApprovalRule,
  listApprovalRules,
} from "@/lib/approvals";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "MANAGE_APPROVAL_RULES");
  if (denied) {
    const viewDenied = forbidUnless(actor, "VIEW_APPROVAL_CENTER");
    if (viewDenied) return viewDenied;
  }

  try {
    const items = await listApprovalRules(actor.organizationId);
    return NextResponse.json({ ok: true, items });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Unable to load rules.",
      },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "MANAGE_APPROVAL_RULES");
  if (denied) return denied;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const item = await createApprovalRule({
      organizationId: actor.organizationId,
      name: String(body.name ?? ""),
      description: (body.description as string) ?? null,
      approvalType: String(body.approvalType ?? "GENERAL_REQUEST"),
      sourceModule: (body.sourceModule as string) ?? null,
      priority: body.priority == null ? 100 : Number(body.priority),
      conditions: (body.conditions as RuleConditions) ?? {},
      workflow: body.workflow as WorkflowDefinition,
      actorUserId: actor.userId,
    });
    await writeAdminAudit({
      organizationId: actor.organizationId,
      actorId: actor.userId,
      action: "APPROVAL_RULE_CREATED",
      entityType: "ApprovalRule",
      entityId: item.id,
      payload: { name: item.name },
    });
    return NextResponse.json({ ok: true, item }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Create failed." },
      { status: 400 },
    );
  }
}
