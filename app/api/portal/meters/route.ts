import { NextResponse } from "next/server";
import { requirePortalAccess } from "@/lib/portal/auth";
import {
  listPortalMeterDashboard,
  listPortalMeterHistory,
  submitPortalMeterReading,
} from "@/lib/portal/meters";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requirePortalAccess("VIEW_CUSTOMER_METER_HISTORY");
  if (!gate.ok) return gate.response;
  try {
    const items = listPortalMeterDashboard(gate.membership);
    return NextResponse.json({ ok: true, items });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Load failed." },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  const gate = await requirePortalAccess("SUBMIT_CUSTOMER_METER");
  if (!gate.ok) return gate.response;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const result = await submitPortalMeterReading({
      membership: gate.membership,
      machineId: String(body.machineId ?? ""),
      meterCount: Number(body.meterCount ?? body.currentReading ?? NaN),
      readingDate: (body.readingDate as string) ?? undefined,
      note: (body.note as string) ?? undefined,
      photoUrl: (body.photoUrl as string) ?? null,
      overrideReason: (body.overrideReason as string) ?? undefined,
      organizationId: gate.actor.organizationId,
    });
    if (!result.ok) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Submit failed." },
      { status: 400 },
    );
  }
}
