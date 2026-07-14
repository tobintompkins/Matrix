import { NextResponse } from "next/server";
import { recordPmMeterReading } from "@/lib/maintenance/pm-prisma-repository";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      machineId?: string;
      meterCount?: number;
      enteredBy?: string;
      notes?: string;
      lowerCountReason?: string;
      recordedAt?: string;
      idempotencyKey?: string;
    };

    if (!body.machineId || body.meterCount === undefined) {
      return NextResponse.json(
        { ok: false, error: "machineId and meterCount are required." },
        { status: 400 },
      );
    }

    const result = await recordPmMeterReading({
      machineId: body.machineId,
      meterCount: Number(body.meterCount),
      enteredBy: body.enteredBy ?? "",
      notes: body.notes,
      lowerCountReason: body.lowerCountReason,
      recordedAt: body.recordedAt,
      idempotencyKey: body.idempotencyKey,
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
