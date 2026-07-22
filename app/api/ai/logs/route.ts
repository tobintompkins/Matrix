import { NextResponse } from "next/server";
import { forbidUnlessAi, resolveAiActor, ensureAiCenterSeeded } from "@/lib/ai";
import { aiEngine } from "@/services/ai";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "VIEW_AI_CENTER");
  if (denied) return denied;
  try {
    await ensureAiCenterSeeded();
    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page") ?? "1");
    const pageSize = Number(url.searchParams.get("pageSize") ?? "25");
    const requestType = url.searchParams.get("requestType") ?? undefined;
    const result = await aiEngine.logs({
      page,
      pageSize,
      requestType,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Failed." },
      { status: 500 },
    );
  }
}
