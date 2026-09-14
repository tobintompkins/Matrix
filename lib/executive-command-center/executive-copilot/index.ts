/**
 * Patch 51C.3 — Executive AI Copilot (extends ECC AI Ask + Matrix Assist packaging).
 */

import { isExecutiveAiCopilot51c3Enabled } from "../feature-flag";
import { answerExecutiveCopilot, listCopilotPresets } from "./answer";
import { getExecutiveDecisionSupport } from "./decision-support";
import { buildDailyExecutiveBriefing } from "./daily-briefing";
import { buildWeeklyExecutiveReport } from "./weekly-report";
import { listExecutiveDashboardWidgets } from "./widgets";

export {
  answerExecutiveCopilot,
  listCopilotPresets,
  getExecutiveDecisionSupport,
  buildDailyExecutiveBriefing,
  buildWeeklyExecutiveReport,
  listExecutiveDashboardWidgets,
};

export async function getExecutiveCopilotBundle(input?: {
  organizationId?: string;
  question?: string;
}) {
  if (!isExecutiveAiCopilot51c3Enabled()) {
    return {
      enabled: false as const,
      message:
        "Executive AI Copilot is disabled (EXECUTIVE_AI_COPILOT_51C3).",
      generatedAt: new Date().toISOString(),
    };
  }

  const [widgets, decisions, daily, weekly] = await Promise.all([
    Promise.resolve(listExecutiveDashboardWidgets()),
    getExecutiveDecisionSupport({ organizationId: input?.organizationId }),
    buildDailyExecutiveBriefing({ organizationId: input?.organizationId }),
    buildWeeklyExecutiveReport({ organizationId: input?.organizationId }),
  ]);

  const sampleAnswer = input?.question
    ? await answerExecutiveCopilot({
        question: input.question,
        organizationId: input.organizationId,
      })
    : null;

  return {
    enabled: true as const,
    generatedAt: new Date().toISOString(),
    presets: listCopilotPresets(),
    widgets,
    decisions,
    dailyBriefing: daily,
    weeklyReport: weekly,
    sampleAnswer,
    neverExecutesActions: true as const,
  };
}
