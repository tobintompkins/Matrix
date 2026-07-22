import { NextResponse } from "next/server";
import { forbidUnlessAi, resolveAiActor } from "@/lib/ai/auth";
import { getAiOperationsTrends } from "@/lib/ai/dashboard";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "VIEW_AI_OPERATIONS");
  if (denied) return denied;
  const url = new URL(request.url);
  const days = Number(url.searchParams.get("days") ?? "30");
  const trends = await getAiOperationsTrends(DEFAULT_ORG_ID, days);
  return NextResponse.json(trends);
}
