import { NextResponse } from "next/server";
import {
  getPmDraft,
  savePmDraft,
} from "@/lib/maintenance/pm-prisma-repository";
import type { PmPartUsed, PmWorkflowChecklistItem } from "@/lib/maintenance/pm-checklist";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const machineId = url.searchParams.get("machineId");
    const technician = url.searchParams.get("technician");
    if (!machineId || !technician) {
      return NextResponse.json(
        { ok: false, error: "machineId and technician are required." },
        { status: 400 },
      );
    }
    const draft = await getPmDraft(machineId, technician);
    return NextResponse.json(
      { ok: true, draft },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      machineId?: string;
      technician?: string;
      checklist?: PmWorkflowChecklistItem[];
      partsUsed?: PmPartUsed[];
      notes?: string;
      timeStarted?: string;
      meterReading?: number | null;
    };
    if (!body.machineId || !body.technician || !body.checklist) {
      return NextResponse.json(
        {
          ok: false,
          error: "machineId, technician, and checklist are required.",
        },
        { status: 400 },
      );
    }
    const result = await savePmDraft({
      machineId: body.machineId,
      technician: body.technician,
      checklist: body.checklist,
      partsUsed: body.partsUsed,
      notes: body.notes,
      timeStarted: body.timeStarted,
      meterReading: body.meterReading,
    });
    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
