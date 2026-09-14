import { NextRequest, NextResponse } from "next/server";
import { forbidUnlessAi, resolveAiActor } from "@/lib/ai/auth";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import {
  getExecutiveCopilotBundle,
  buildDailyExecutiveBriefing,
  buildWeeklyExecutiveReport,
  getExecutiveDecisionSupport,
  listExecutiveDashboardWidgets,
  listCopilotPresets,
} from "@/lib/executive-command-center/executive-copilot";
import { isExecutiveAiCopilot51c3Enabled } from "@/lib/executive-command-center/feature-flag";

export const dynamic = "force-dynamic";

/**
 * Patch 51C.3 — Executive AI Copilot bundle (widgets, daily/weekly, decisions).
 * Ask/Q&A remains on /insights/ask — this does not create a second assistant.
 */
export async function GET(req: NextRequest) {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "USE_EXECUTIVE_AI_INSIGHTS");
  if (denied) {
    const deniedEcc = forbidUnlessAi(actor, "VIEW_EXECUTIVE_COMMAND_CENTER");
    if (deniedEcc) return deniedEcc;
  }

  if (!isExecutiveAiCopilot51c3Enabled()) {
    return NextResponse.json({
      ok: true,
      enabled: false,
      message: "Executive AI Copilot is disabled (EXECUTIVE_AI_COPILOT_51C3).",
    });
  }

  const view = req.nextUrl.searchParams.get("view") || "bundle";

  try {
    if (view === "widgets") {
      return NextResponse.json({
        ok: true,
        enabled: true,
        widgets: listExecutiveDashboardWidgets(),
      });
    }
    if (view === "daily") {
      const daily = await buildDailyExecutiveBriefing({
        organizationId: DEFAULT_ORG_ID,
      });
      return NextResponse.json({ ok: true, enabled: true, dailyBriefing: daily });
    }
    if (view === "weekly") {
      const weekly = await buildWeeklyExecutiveReport({
        organizationId: DEFAULT_ORG_ID,
      });
      return NextResponse.json({ ok: true, enabled: true, weeklyReport: weekly });
    }
    if (view === "decisions") {
      const decisions = await getExecutiveDecisionSupport({
        organizationId: DEFAULT_ORG_ID,
      });
      return NextResponse.json({ ok: true, enabled: true, decisions });
    }

    const bundle = await getExecutiveCopilotBundle({
      organizationId: DEFAULT_ORG_ID,
    });
    return NextResponse.json({
      ok: true,
      ...bundle,
      presets: listCopilotPresets(),
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error:
          e instanceof Error
            ? e.message
            : "Failed to load Executive AI Copilot.",
      },
      { status: 500 },
    );
  }
}
