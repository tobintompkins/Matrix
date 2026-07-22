import { NextResponse } from "next/server";
import { forbidUnlessAi, resolveAiActor } from "@/lib/ai/auth";
import { listAiInsights } from "@/lib/ai/insights-query";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "VIEW_AI_INSIGHTS");
  if (denied) return denied;
  try {
    const url = new URL(request.url);
    const result = await listAiInsights({
      organizationId: DEFAULT_ORG_ID,
      severity: url.searchParams.get("severity") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      sourceModule: url.searchParams.get("sourceModule") ?? undefined,
      insightType: url.searchParams.get("insightType") ?? undefined,
      customer: url.searchParams.get("customer") ?? undefined,
      site: url.searchParams.get("site") ?? undefined,
      machine: url.searchParams.get("machine") ?? undefined,
      assignedReviewerId: url.searchParams.get("assignedReviewerId") ?? undefined,
      minConfidence: url.searchParams.get("minConfidence")
        ? Number(url.searchParams.get("minConfidence"))
        : undefined,
      maxConfidence: url.searchParams.get("maxConfidence")
        ? Number(url.searchParams.get("maxConfidence"))
        : undefined,
      q: url.searchParams.get("q") ?? undefined,
      sort: (url.searchParams.get("sort") as
        | "severity"
        | "confidence"
        | "newest"
        | "oldest"
        | "updated"
        | null) ?? "newest",
      page: Number(url.searchParams.get("page") ?? "1"),
      pageSize: Number(url.searchParams.get("pageSize") ?? "25"),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Failed." },
      { status: 500 },
    );
  }
}
