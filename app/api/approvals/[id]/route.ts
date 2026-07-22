import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import {
  getApprovalRequest,
  updateDraft,
} from "@/lib/approvals";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "VIEW_APPROVAL_CENTER");
  if (denied) return denied;
  const { id } = await context.params;

  try {
    const item = await getApprovalRequest(actor, id);
    return NextResponse.json({ ok: true, item });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = /not found/i.test(msg)
      ? 404
      : /access|permission/i.test(msg)
        ? 403
        : 400;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

export async function PATCH(request: Request, context: Ctx) {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "CREATE_APPROVAL_REQUEST");
  if (denied) return denied;
  const { id } = await context.params;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    // Hard block status / decision mass-assignment
    const forbidden = [
      "status",
      "completedAt",
      "signatureHash",
      "decidedByUserId",
      "version",
      "requestNumber",
      "requesterUserId",
      "organizationId",
    ];
    for (const key of forbidden) {
      if (key in body) {
        return NextResponse.json(
          {
            ok: false,
            error: `Field "${key}" cannot be set via PATCH. Use workflow action endpoints.`,
          },
          { status: 400 },
        );
      }
    }

    const item = await updateDraft(actor, {
      id,
      title: body.title as string | undefined,
      description: body.description as string | null | undefined,
      businessJustification: body.businessJustification as
        | string
        | null
        | undefined,
      approvalType: body.approvalType as string | undefined,
      sourceModule: body.sourceModule as string | null | undefined,
      sourceRecordId: body.sourceRecordId as string | null | undefined,
      priority: body.priority as
        | "CRITICAL"
        | "HIGH"
        | "NORMAL"
        | "LOW"
        | undefined,
      requesterDepartmentId: body.requesterDepartmentId as
        | string
        | null
        | undefined,
      requestedAmount:
        body.requestedAmount === undefined
          ? undefined
          : body.requestedAmount == null
            ? null
            : Number(body.requestedAmount),
      currency: body.currency as string | undefined,
      dueAt: body.dueAt as string | null | undefined,
      customerId: body.customerId as string | null | undefined,
      machineId: body.machineId as string | null | undefined,
      serviceCallId: body.serviceCallId as string | null | undefined,
      partsOrderId: body.partsOrderId as string | null | undefined,
    });
    return NextResponse.json({ ok: true, item });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Unable to update draft.",
      },
      { status: 400 },
    );
  }
}
