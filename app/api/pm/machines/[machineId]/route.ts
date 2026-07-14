import { NextResponse } from "next/server";
import { getMachinePmDetail } from "@/lib/maintenance/pm-prisma-repository";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ machineId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { machineId } = await context.params;
    const detail = await getMachinePmDetail(machineId);
    if (!detail) {
      return NextResponse.json(
        { ok: false, error: `Machine not found: ${machineId}` },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { ok: true, machine: detail },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
