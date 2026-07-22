import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { hasMatrixPermission } from "@/lib/auth/permissions";
import {
  approvalsToCsv,
  createApprovalRequest,
  listApprovalRequests,
} from "@/lib/approvals";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "VIEW_APPROVAL_CENTER");
  if (denied) return denied;

  const url = new URL(request.url);
  const exportFmt = url.searchParams.get("export");

  try {
    const result = await listApprovalRequests({
      organizationId: actor.organizationId,
      actorUserId: actor.userId,
      canViewAll: hasMatrixPermission(actor.role, "VIEW_ALL_APPROVALS"),
      status: url.searchParams.get("status") ?? undefined,
      priority: url.searchParams.get("priority") ?? undefined,
      approvalType: url.searchParams.get("approvalType") ?? undefined,
      departmentId: url.searchParams.get("department") ?? undefined,
      requesterUserId: url.searchParams.get("requester") ?? undefined,
      assignedApproverUserId: url.searchParams.get("approver") ?? undefined,
      submittedFrom: url.searchParams.get("submittedFrom") ?? undefined,
      submittedTo: url.searchParams.get("submittedTo") ?? undefined,
      dueFrom: url.searchParams.get("dueFrom") ?? undefined,
      dueTo: url.searchParams.get("dueTo") ?? undefined,
      overdueOnly: url.searchParams.get("overdueOnly") === "1",
      awaitingMe: url.searchParams.get("awaitingMe") === "1",
      myRequests: url.searchParams.get("myRequests") === "1",
      escalatedOnly: url.searchParams.get("escalatedOnly") === "1",
      archived: url.searchParams.get("archived") === "1",
      q: url.searchParams.get("q") ?? undefined,
      page: Number(url.searchParams.get("page") ?? "1"),
      pageSize: Number(url.searchParams.get("pageSize") ?? "20"),
      sortBy: url.searchParams.get("sortBy") ?? undefined,
      sortDir: (url.searchParams.get("sortDir") as "asc" | "desc") ?? "desc",
    });

    if (exportFmt === "csv") {
      if (!hasMatrixPermission(actor.role, "EXPORT_APPROVALS")) {
        return NextResponse.json(
          { ok: false, error: "Missing EXPORT_APPROVALS permission." },
          { status: 403 },
        );
      }
      const csv = approvalsToCsv(result.items as unknown as Array<Record<string, unknown>>);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="approvals.csv"',
        },
      });
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unable to load approvals.",
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "CREATE_APPROVAL_REQUEST");
  if (denied) return denied;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    // Never trust client-supplied requester identity
    const created = await createApprovalRequest(actor, {
      title: String(body.title ?? ""),
      description: (body.description as string) ?? null,
      businessJustification: (body.businessJustification as string) ?? null,
      approvalType: String(body.approvalType ?? "GENERAL_REQUEST"),
      sourceModule: (body.sourceModule as string) ?? null,
      sourceRecordId: (body.sourceRecordId as string) ?? null,
      priority: (body.priority as "CRITICAL" | "HIGH" | "NORMAL" | "LOW") ?? "NORMAL",
      requesterDepartmentId: (body.requesterDepartmentId as string) ?? null,
      requestedAmount:
        body.requestedAmount == null ? null : Number(body.requestedAmount),
      currency: (body.currency as string) ?? "USD",
      dueAt: (body.dueAt as string) ?? null,
      customerId: (body.customerId as string) ?? null,
      machineId: (body.machineId as string) ?? null,
      serviceCallId: (body.serviceCallId as string) ?? null,
      partsOrderId: (body.partsOrderId as string) ?? null,
      submit: Boolean(body.submit),
    });
    return NextResponse.json({ ok: true, item: created }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Unable to create approval.",
      },
      { status: 400 },
    );
  }
}
