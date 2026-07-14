import { NextResponse } from "next/server";
import {
  forbidUnless,
  resolveMatrixAssistActor,
} from "@/lib/matrix-assist/auth";
import {
  getDiagnosticSession,
  updateSessionStatus,
  writeAssistAudit,
} from "@/lib/matrix-assist/repository";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function canAccessSession(
  actor: Awaited<ReturnType<typeof resolveMatrixAssistActor>>,
  session: { technicianId: string | null },
): boolean {
  if (actor.canViewTeamSessions) return true;
  if (!session.technicianId) return true;
  return session.technicianId === actor.userId;
}

export async function GET(_request: Request, { params }: Params) {
  const actor = await resolveMatrixAssistActor();
  const denied = forbidUnless(actor, "VIEW_MATRIX_ASSIST_SESSIONS");
  if (denied) {
    const useDenied = forbidUnless(actor, "USE_MATRIX_ASSIST");
    if (useDenied) return useDenied;
  }

  const { id } = await params;
  const session = await getDiagnosticSession(id);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Session not found." }, { status: 404 });
  }
  if (!canAccessSession(actor, session)) {
    return NextResponse.json(
      {
        ok: false,
        error: "You do not have permission to use Matrix Assist for this record.",
      },
      { status: 403 },
    );
  }
  return NextResponse.json({ ok: true, session });
}

export async function PATCH(request: Request, { params }: Params) {
  const actor = await resolveMatrixAssistActor();
  const denied = forbidUnless(actor, "USE_MATRIX_ASSIST");
  if (denied) return denied;

  const { id } = await params;
  const session = await getDiagnosticSession(id);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Session not found." }, { status: 404 });
  }
  if (!canAccessSession(actor, session)) {
    return NextResponse.json(
      {
        ok: false,
        error: "You do not have permission to use Matrix Assist for this record.",
      },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    status?: "DRAFT" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
    technicianConclusion?: string;
  };

  if (body.status === "COMPLETED" || body.status === "CANCELLED") {
    const updated = await updateSessionStatus(id, body.status, {
      technicianConclusion: body.technicianConclusion,
    });
    await writeAssistAudit({
      organizationId: actor.organizationId,
      action:
        body.status === "COMPLETED"
          ? "matrix_assist.session_completed"
          : "matrix_assist.session_cancelled",
      entityId: id,
      payload: { conclusion: body.technicianConclusion ?? null },
    });
    return NextResponse.json({
      ok: true,
      session: updated,
      note: "Completing a diagnostic session does not close the service call.",
    });
  }

  if (body.technicianConclusion) {
    const updated = await updateSessionStatus(id, "IN_PROGRESS", {
      technicianConclusion: body.technicianConclusion,
    });
    return NextResponse.json({ ok: true, session: updated });
  }

  return NextResponse.json({ ok: false, error: "No updates provided." }, { status: 400 });
}
