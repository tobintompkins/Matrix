/**
 * Patch 51A.5 / 51C.3 — Executive AI Insights Q&A.
 * 51C.3: delegates to Executive AI Copilot when enabled (same ECC surface; no new assistant).
 */

import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import { isExecutiveAiCopilot51c3Enabled } from "./feature-flag";
import {
  answerExecutiveCopilot,
  listCopilotPresets,
} from "./executive-copilot/answer";
import type { ExecutiveCopilotAnswer } from "./executive-copilot/types";

/** Backward-compatible answer shape + Copilot enrichment fields. */
export type ExecutiveInsightAnswer = {
  question: string;
  answer: string;
  observed: string[];
  interpretation: string[];
  sources: Array<{ label: string; href: string }>;
  isSample: boolean;
  provider: string;
  model: string;
  generatedAt: string;
  confidence?: number;
  supportingRecords?: ExecutiveCopilotAnswer["supportingRecords"];
  relatedReports?: ExecutiveCopilotAnswer["relatedReports"];
  assumptions?: string[];
  recommendations?: ExecutiveCopilotAnswer["recommendations"];
  fabricated?: false;
};

export function listExecutiveInsightPresets() {
  if (isExecutiveAiCopilot51c3Enabled()) {
    return listCopilotPresets();
  }
  return [
    { id: "attention-today", label: "What needs attention today?" },
    {
      id: "machine-risk",
      label: "Which machines have the greatest operational risk?",
    },
    { id: "customers", label: "Which customers are deteriorating?" },
    { id: "repeats", label: "Where are repeat failures increasing?" },
    { id: "pm", label: "Which PMs are most urgent?" },
    {
      id: "inventory",
      label: "What inventory shortages could affect service?",
    },
    { id: "technicians", label: "Which technicians appear overloaded?" },
    { id: "changed", label: "What changed from the previous period?" },
    { id: "forecasts", label: "What do business forecasts show?" },
  ];
}

export async function answerExecutiveInsight(input: {
  question: string;
  organizationId?: string;
}): Promise<ExecutiveInsightAnswer> {
  const organizationId = input.organizationId ?? DEFAULT_ORG_ID;

  if (isExecutiveAiCopilot51c3Enabled()) {
    const a = await answerExecutiveCopilot({
      question: input.question,
      organizationId,
    });
    return {
      question: a.question,
      answer: a.answer,
      observed: a.observed,
      interpretation: a.interpretation,
      sources: a.sources,
      isSample: a.isSample,
      provider: a.provider,
      model: a.model,
      generatedAt: a.generatedAt,
      confidence: a.confidence,
      supportingRecords: a.supportingRecords,
      relatedReports: a.relatedReports,
      assumptions: a.assumptions,
      recommendations: a.recommendations,
      fabricated: false,
    };
  }

  // Soft-disable fallback: minimal deterministic answer without Copilot enrichment
  const { getExecutivePeriodReport } = await import("./reporting");
  const report = await getExecutivePeriodReport({
    organizationId,
    period: "DAILY",
    bypassCache: true,
  });
  return {
    question: input.question.trim() || "What needs attention today?",
    answer: report.aiSummary.summary,
    observed: report.highlights.slice(0, 6),
    interpretation: [
      "Executive AI Copilot is disabled; returning daily report summary only.",
    ],
    sources: [
      {
        label: "Report Center",
        href: "/executive-command-center/report-center",
      },
    ],
    isSample: true,
    provider: "matrix-local",
    model: "executive-insights-qa-disabled-v1",
    generatedAt: new Date().toISOString(),
    confidence: 40,
    assumptions: ["EXECUTIVE_AI_COPILOT_51C3 is off."],
    fabricated: false,
  };
}
