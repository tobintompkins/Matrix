import { NextResponse } from "next/server";
import {
  correctPmHistory,
  getPmHistoryById,
} from "@/lib/maintenance/pm-prisma-repository";
import {
  forbidUnless,
  resolvePmApiActor,
} from "@/lib/maintenance/pm-api-auth";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ historyId: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const actor = await resolvePmApiActor();
    const denied = forbidUnless(actor, "VIEW_FLEET_MAINTENANCE");
    if (denied) return denied;

    const { historyId } = await params;
    const record = await getPmHistoryById(historyId);
    if (!record) {
      return NextResponse.json(
        { ok: false, error: "PM history record not found." },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { ok: true, record },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const actor = await resolvePmApiActor();
    const denied = forbidUnless(actor, "CORRECT_MAINTENANCE_RECORDS");
    if (denied) return denied;

    const { historyId } = await params;
    const body = (await request.json()) as {
      notes?: string;
      workPerformed?: string;
    };
    const result = await correctPmHistory({
      historyId,
      actor: actor.displayName,
      notes: body.notes,
      workPerformed: body.workPerformed,
    });
    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json({ ok: true, record: result.record });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
