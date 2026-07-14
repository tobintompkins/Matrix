import { NextResponse } from "next/server";
import { completePm } from "@/lib/maintenance/pm-prisma-repository";
import type { PmPartUsed, PmWorkflowChecklistItem } from "@/lib/maintenance/pm-checklist";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      machineId?: string;
      countAtCompletion?: number;
      technician?: string;
      recordedBy?: string;
      notes?: string;
      completedAt?: string;
      idempotencyKey?: string;
      pmInterval?: number;
      timeStarted?: string;
      timeFinished?: string;
      checklist?: PmWorkflowChecklistItem[];
      partsUsed?: PmPartUsed[];
      workPerformed?: string;
      customerSignaturePlaceholder?: string;
    };

    if (!body.machineId || body.countAtCompletion === undefined) {
      return NextResponse.json(
        { ok: false, error: "machineId and countAtCompletion are required." },
        { status: 400 },
      );
    }
    if (!body.idempotencyKey) {
      return NextResponse.json(
        { ok: false, error: "idempotencyKey is required." },
        { status: 400 },
      );
    }

    const result = await completePm({
      machineId: body.machineId,
      countAtCompletion: Number(body.countAtCompletion),
      technician: body.technician ?? "",
      recordedBy: body.recordedBy,
      notes: body.notes,
      completedAt: body.completedAt,
      idempotencyKey: body.idempotencyKey,
      pmInterval:
        body.pmInterval === undefined ? undefined : Number(body.pmInterval),
      timeStarted: body.timeStarted,
      timeFinished: body.timeFinished,
      checklist: body.checklist,
      partsUsed: body.partsUsed,
      workPerformed: body.workPerformed,
      customerSignaturePlaceholder: body.customerSignaturePlaceholder,
    });

    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(result, { status: result.idempotent ? 200 : 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
