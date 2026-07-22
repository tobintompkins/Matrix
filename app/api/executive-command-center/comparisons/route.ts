import { NextRequest, NextResponse } from "next/server";
import { forbidUnlessAi, resolveAiActor } from "@/lib/ai/auth";
import { getTrendComparisons } from "@/lib/executive-command-center/reporting";
import type { ComparisonMode } from "@/lib/executive-command-center/reporting-types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "VIEW_EXECUTIVE_REPORTS");
  if (denied) return denied;

  const mode = (req.nextUrl.searchParams.get("mode") ||
    "WEEK_VS_PREV") as ComparisonMode;
  const allowed: ComparisonMode[] = [
    "WEEK_VS_PREV",
    "MONTH_VS_PREV",
    "QUARTER_VS_PREV",
    "YEAR_VS_PREV",
  ];
  try {
    const comparisons = await getTrendComparisons(
      allowed.includes(mode) ? mode : "WEEK_VS_PREV",
    );
    return NextResponse.json({ ok: true, ...comparisons });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Comparison failed.",
      },
      { status: 500 },
    );
  }
}
