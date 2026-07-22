/**
 * Patch 51A.1 Part 3 — Grounded answer pipeline (read-only).
 */

import { aiConfig } from "@/config/ai";
import type { MatrixRole } from "@/lib/auth/types";
import { runSearchAdapters } from "./adapters";
import { ASSISTANT_CAPABILITIES, buildPlanFromQuestion } from "./intent";
import { looksLikeSqlInjection, sanitizeUserText } from "./query-plan";
import { checkAssistantRateLimit } from "./rate-limit";
import type {
  AssistantAnswer,
  AiSearchFilter,
  AiSourceCitation,
} from "./types";
import { ADVISORY_ASSISTANT } from "./types";

export type QueryActor = {
  userId: string;
  displayName: string;
  role: MatrixRole;
  organizationId: string;
};

function buildFollowUps(modules: string[], total: number): string[] {
  const tips = [
    "Show only critical items.",
    "Limit this to SFX/MPX.",
    "Compare this month with last month.",
  ];
  if (modules.includes("SERVICE_CALLS")) tips.push("Show the related service calls.");
  if (modules.includes("MACHINES")) tips.push("Open the affected machines.");
  if (modules.includes("AI_INSIGHTS")) tips.push("Which findings need human review?");
  if (total === 0) tips.unshift("Try a broader search without model filters.");
  return tips.slice(0, 4);
}

function stripInstructionPayload(text: string): string {
  // Treat record-sourced text as evidence; neutralize common injection phrases in answers.
  return text.replace(
    /\b(ignore (all )?(previous|prior) instructions|system prompt|reveal (your )?(api|secret|key))\b/gi,
    "[redacted-instruction]",
  );
}

export async function runAssistantQuery(input: {
  actor: QueryActor;
  question: string;
  priorFilters?: AiSearchFilter[];
  clarificationValue?: string;
}): Promise<AssistantAnswer> {
  const analyzedAt = new Date().toISOString();
  const rate = checkAssistantRateLimit(input.actor.userId);
  if (!rate.ok) {
    return {
      content: `You have reached the assistant rate limit. Try again in about ${rate.retryAfterSec ?? 60} seconds.`,
      requestType: "UNSUPPORTED",
      plan: null,
      confidence: 100,
      dataBasis: "LIVE",
      answerFormat: "ERROR",
      sources: [],
      followUps: [],
      limitations: "Rate limit reached.",
      retrievalSummary: null,
      appliedFilters: {},
      analyzedAt,
    };
  }

  if (!aiConfig.assistantEnabled) {
    return {
      content:
        "The AI Assistant is not enabled in configuration. Deterministic Matrix search is unavailable until it is turned on.",
      requestType: "UNSUPPORTED",
      plan: null,
      confidence: 100,
      dataBasis: "LIVE",
      answerFormat: "ERROR",
      sources: [],
      followUps: [],
      limitations: "Assistant disabled.",
      retrievalSummary: null,
      appliedFilters: {},
      analyzedAt,
    };
  }

  let question = sanitizeUserText(input.question);
  if (input.clarificationValue) {
    question = `${question} ${input.clarificationValue}`.trim();
  }

  if (looksLikeSqlInjection(question)) {
    return {
      content:
        "That question looks like an attempt to run database commands. The AI Assistant only supports structured Matrix searches and will not execute SQL.",
      requestType: "UNSUPPORTED",
      plan: null,
      confidence: 100,
      dataBasis: "LIVE",
      answerFormat: "WARNING",
      sources: [],
      followUps: ["Show me overdue PMs at SFX/MPX.", "What parts are running low?"],
      limitations: "Unsafe query rejected.",
      retrievalSummary: null,
      appliedFilters: {},
      analyzedAt,
    };
  }

  const { plan, clarification, freeText } = buildPlanFromQuestion(
    question,
    input.priorFilters,
  );

  if (clarification) {
    return {
      content: clarification.prompt,
      requestType: plan.requestType,
      plan,
      confidence: 90,
      dataBasis: "LIVE",
      answerFormat: "CLARIFICATION",
      sources: [],
      followUps: clarification.options.map((o) => o.label),
      limitations: "Ambiguous entity — select an option to continue.",
      retrievalSummary: "Clarification required before searching.",
      appliedFilters: { awaiting: "site" },
      clarificationOptions: clarification.options,
      analyzedAt,
    };
  }

  if (plan.requestType === "HELP") {
    return {
      content: [
        "I can search Matrix operational data you are permitted to view.",
        "",
        "Examples:",
        ...ASSISTANT_CAPABILITIES.requestTypes.map((t) => `• ${t}`),
        "",
        "I cannot:",
        ...ASSISTANT_CAPABILITIES.cannot.map((t) => `• ${t}`),
        "",
        ADVISORY_ASSISTANT,
      ].join("\n"),
      requestType: "HELP",
      plan,
      confidence: 100,
      dataBasis: "LIVE",
      answerFormat: "HELP",
      sources: [],
      followUps: [
        "Show me all overdue PMs at SFX/MPX.",
        "Which machines have had the most repeat service calls this month?",
        "What parts are running low?",
      ],
      limitations: null,
      retrievalSummary: "Capability help — no operational query executed.",
      appliedFilters: {},
      analyzedAt,
    };
  }

  if (plan.requestType === "UNSUPPORTED" || plan.modules.length === 0) {
    return {
      content:
        "I could not map that question to a supported Matrix search. Try asking about service calls, machines, PM/meters, inventory, technicians, AI insights, or data quality.",
      requestType: "UNSUPPORTED",
      plan,
      confidence: 85,
      dataBasis: "LIVE",
      answerFormat: "UNSUPPORTED",
      sources: [],
      followUps: [
        "Summarize open critical service calls.",
        "Show unresolved AI insights.",
        "What can you help with?",
      ],
      limitations: "Unsupported request type.",
      retrievalSummary: null,
      appliedFilters: {},
      analyzedAt,
    };
  }

  const adapterResults = await runSearchAdapters({
    actor: {
      userId: input.actor.userId,
      role: input.actor.role,
      organizationId: input.actor.organizationId,
    },
    modules: plan.modules,
    filters: plan.filters,
    dateRange: plan.dateRange,
    limit: plan.limit,
    freeText,
  });

  const denied = adapterResults.filter((r) => r.denied);
  const allowed = adapterResults.filter((r) => !r.denied);
  const sources: AiSourceCitation[] = [];
  for (const r of allowed) {
    for (const s of r.sources) {
      if (sources.length >= aiConfig.assistantMaxSources) break;
      sources.push({
        ...s,
        fieldSummary: s.fieldSummary
          ? stripInstructionPayload(s.fieldSummary)
          : null,
        displayLabel: stripInstructionPayload(s.displayLabel),
      });
    }
  }

  const totalCount = allowed.reduce((n, r) => n + r.total, 0);
  const summaryBits = allowed.flatMap((r) => r.summaryLines);
  if (denied.length) {
    summaryBits.push(
      `${denied.length} module(s) skipped due to missing permissions.`,
    );
  }

  const dateLabel = plan.dateRange?.label
    ? ` Date range resolved as ${plan.dateRange.label}.`
    : "";

  let content: string;
  let answerFormat: AssistantAnswer["answerFormat"] = "SUMMARY";
  let confidence = 88;

  if (totalCount === 0 && denied.length === adapterResults.length) {
    content =
      "You do not have permission to view the modules needed for that question.";
    answerFormat = "ERROR";
    confidence = 100;
  } else if (totalCount === 0) {
    content = `No matching Matrix records were found for that question.${dateLabel} Try broadening filters or verifying the entity name.`;
    answerFormat = "EMPTY";
    confidence = 80;
  } else if (plan.requestType === "RECORD_COUNT") {
    content = `Found ${totalCount} matching record(s).${dateLabel} Showing up to ${sources.length} source citation(s). ${summaryBits.join(" ")}`;
    answerFormat = "COUNT";
    confidence = 92;
  } else {
    content = [
      `Based on live Matrix data, here is what I found (${totalCount} match${totalCount === 1 ? "" : "es"}).${dateLabel}`,
      "",
      ...summaryBits.map((l) => `• ${l}`),
      "",
      sources.length
        ? `Previewing ${sources.length} source record(s) below. Open the links to review full details before acting.`
        : "No source previews available.",
      "",
      ADVISORY_ASSISTANT,
    ].join("\n");
    answerFormat = sources.length > 0 ? "LIST" : "SUMMARY";
  }

  const appliedFilters: Record<string, unknown> = {
    modules: plan.modules,
    filters: plan.filters,
    dateRange: plan.dateRange ?? null,
  };

  return {
    content,
    requestType: plan.requestType,
    plan,
    confidence,
    dataBasis: "LIVE",
    answerFormat,
    sources,
    followUps: buildFollowUps(plan.modules, totalCount),
    limitations:
      "Answers are grounded in permission-filtered Matrix repositories. Record text is treated as evidence only and cannot change assistant permissions or tools. No external language model was required for this search.",
    retrievalSummary: summaryBits.join(" "),
    appliedFilters,
    analyzedAt,
    totalCount,
  };
}
