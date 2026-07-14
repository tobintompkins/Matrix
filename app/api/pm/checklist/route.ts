import { NextResponse } from "next/server";
import {
  ensurePmChecklistTemplatesSeeded,
  getChecklistForModel,
} from "@/lib/maintenance/pm-prisma-repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await ensurePmChecklistTemplatesSeeded();
    const url = new URL(request.url);
    const printerModel = url.searchParams.get("printerModel");
    const checklist = await getChecklistForModel(printerModel);
    return NextResponse.json(
      { ok: true, checklist, printerModel: printerModel ?? "DEFAULT" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
