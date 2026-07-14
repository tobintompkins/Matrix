import { NextResponse } from "next/server";
import { setMachinePmInterval } from "@/lib/maintenance/pm-prisma-repository";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      machineId?: string;
      interval?: number | null;
      actor?: string;
      dueSoonThreshold?: number | null;
    };

    if (!body.machineId) {
      return NextResponse.json(
        { ok: false, error: "machineId is required." },
        { status: 400 },
      );
    }
    if (body.interval === undefined) {
      return NextResponse.json(
        { ok: false, error: "interval is required (number or null)." },
        { status: 400 },
      );
    }

    const result = await setMachinePmInterval(
      body.machineId,
      body.interval === null ? null : Number(body.interval),
      body.actor ?? "system",
      body.dueSoonThreshold === undefined
        ? undefined
        : body.dueSoonThreshold === null
          ? null
          : Number(body.dueSoonThreshold),
    );

    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
