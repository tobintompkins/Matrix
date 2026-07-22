/**
 * Patch 51A.1 Part 3 — Deterministic NL intent → validated query plan.
 * No LLM required. Never executes arbitrary SQL.
 */

import type { AiRequestType, AiSearchFilter, AiSearchModule, AiSearchPlan } from "./types";
import { resolveRelativeDateRange } from "./dates";
import { sanitizeUserText, validateQueryPlan } from "./query-plan";

function detectModules(q: string): AiSearchModule[] {
  const modules = new Set<AiSearchModule>();
  if (/\b(pm|preventive|overdue|cleaning|meter)\b/.test(q)) modules.add("PM");
  if (/\b(meter|copy count)\b/.test(q)) modules.add("METERS");
  if (/\b(service call|ticket|work order|repeat|paper jam)\b/.test(q)) {
    modules.add("SERVICE_CALLS");
  }
  if (/\b(inventory|stock|part|parts|low stock)\b/.test(q)) {
    modules.add("INVENTORY");
    modules.add("PARTS");
  }
  if (/\b(technician|workload|tech)\b/.test(q)) modules.add("TECHNICIANS");
  if (/\b(insight|ai insight)\b/.test(q)) modules.add("AI_INSIGHTS");
  if (/\b(data quality|duplicate|orphan|invalid meter)\b/.test(q)) {
    modules.add("DATA_QUALITY");
  }
  if (/\b(customer|customers)\b/.test(q)) modules.add("CUSTOMERS");
  if (/\b(site|sites|warehouse)\b/.test(q)) modules.add("SITES");
  if (/\b(machine|fleet|printer|serial|gd9630|valezus|sfx|mpx)\b/.test(q)) {
    modules.add("MACHINES");
  }
  if (modules.size === 0) {
    modules.add("MACHINES");
    modules.add("SERVICE_CALLS");
  }
  return [...modules];
}

function detectRequestType(q: string): AiRequestType {
  if (/^(help|what can you|capabilities)\b/.test(q) || /\bhelp\b/.test(q) && q.length < 40) {
    return "HELP";
  }
  if (/\bhow many|count|number of\b/.test(q)) return "RECORD_COUNT";
  if (/\bsummarize|summary|overview\b/.test(q)) return "SUMMARY";
  if (/\btrend|over time|this month vs\b/.test(q)) return "TREND";
  if (/\bcompare|comparison\b/.test(q)) return "COMPARISON";
  if (/\binsight\b/.test(q)) return "AI_INSIGHT_SEARCH";
  if (/\bfleet health|health of\b/.test(q)) return "FLEET_HEALTH";
  if (/\boverdue pm|pm analysis|cleaning\b/.test(q)) return "PM_ANALYSIS";
  if (/\binventory|low stock|parts\b/.test(q)) return "INVENTORY_ANALYSIS";
  if (/\btechnician|workload\b/.test(q)) return "TECHNICIAN_ANALYSIS";
  if (/\bdata quality|invalid meter|duplicate\b/.test(q)) return "DATA_QUALITY_CHECK";
  if (/\bservice call|repeat service\b/.test(q)) return "SERVICE_ANALYSIS";
  if (/\bcustomer\b/.test(q)) return "CUSTOMER_ANALYSIS";
  return "RECORD_SEARCH";
}

function extractFilters(q: string): AiSearchFilter[] {
  const filters: AiSearchFilter[] = [];

  const orgMatch = q.match(/\b(sfx\/mpx|sfx|mpx)\b/i);
  if (orgMatch) {
    filters.push({
      field: "organization",
      operator: "CONTAINS",
      value: orgMatch[1]!.toUpperCase().includes("SFX") && orgMatch[1]!.toUpperCase().includes("MPX")
        ? "SFX"
        : orgMatch[1]!.toUpperCase(),
    });
  }

  const modelMatch = q.match(/\b(gd\s*-?\s*\d+[a-z0-9]*|valezus[a-z0-9-]*)\b/i);
  if (modelMatch) {
    filters.push({
      field: "model",
      operator: "CONTAINS",
      value: modelMatch[1]!.replace(/\s+/g, ""),
    });
  }

  const serialMatch = q.match(/\bserial(?:\s+number)?\s+([a-z0-9-]+)\b/i);
  if (serialMatch) {
    filters.push({
      field: "serialNumber",
      operator: "CONTAINS",
      value: serialMatch[1],
    });
  }

  if (/\bcritical\b/.test(q)) {
    filters.push({ field: "priority", operator: "EQUALS", value: "CRITICAL" });
    filters.push({ field: "severity", operator: "EQUALS", value: "CRITICAL" });
  }
  if (/\bopen\b/.test(q) && /\bservice\b/.test(q)) {
    filters.push({ field: "status", operator: "NOT_EQUALS", value: "CLOSED" });
  }

  return filters;
}

function findAmbiguousSites(q: string): string[] | null {
  // Lightweight clarification: "main warehouse" without org/customer
  if (/\bmain warehouse\b/i.test(q) && !/\b(sfx|mpx|customer)\b/i.test(q)) {
    return ["SFX Main Warehouse", "MPX Main Warehouse"];
  }
  return null;
}

export function buildPlanFromQuestion(
  rawQuestion: string,
  priorFilters?: AiSearchFilter[],
): {
  plan: AiSearchPlan;
  clarification?: { prompt: string; options: Array<{ id: string; label: string; value: string }> };
  freeText: string;
} {
  const question = sanitizeUserText(rawQuestion);
  const q = question.toLowerCase();

  const ambiguous = findAmbiguousSites(q);
  if (ambiguous) {
    const plan = validateQueryPlan({
      requestType: "RECORD_SEARCH",
      modules: ["SITES"],
      filters: [],
      limit: 5,
      includeSummary: true,
      includeSources: true,
    });
    return {
      plan: plan.ok
        ? plan.plan
        : {
            requestType: "UNSUPPORTED",
            modules: [],
            filters: [],
            limit: 5,
            includeSummary: true,
            includeSources: false,
          },
      clarification: {
        prompt: 'I found two sites named "Main Warehouse." Which one did you mean?',
        options: ambiguous.map((label, i) => ({
          id: `site-${i}`,
          label,
          value: label,
        })),
      },
      freeText: question,
    };
  }

  const requestType = detectRequestType(q);
  if (requestType === "HELP") {
    const plan = validateQueryPlan({
      requestType: "HELP",
      modules: [],
      filters: [],
      limit: 5,
      includeSummary: true,
      includeSources: false,
    });
    return {
      plan: plan.ok
        ? plan.plan
        : {
            requestType: "HELP",
            modules: [],
            filters: [],
            limit: 5,
            includeSummary: true,
            includeSources: false,
          },
      freeText: question,
    };
  }

  const modules = detectModules(q);
  const filters = [...(priorFilters ?? []), ...extractFilters(q)];
  const dateRange = resolveRelativeDateRange(question) ?? undefined;

  // SFX/MPX special: search both orgs loosely
  if (/\bsfx\/mpx\b/i.test(question)) {
    // keep organization filter soft — adapters use contains
  }

  const validated = validateQueryPlan({
    requestType,
    modules,
    filters,
    dateRange: dateRange
      ? { from: dateRange.from, to: dateRange.to, label: dateRange.label }
      : undefined,
    limit: requestType === "RECORD_COUNT" ? 25 : 15,
    includeSummary: true,
    includeSources: true,
  });

  if (!validated.ok) {
    return {
      plan: {
        requestType: "UNSUPPORTED",
        modules: [],
        filters: [],
        limit: 5,
        includeSummary: true,
        includeSources: false,
      },
      freeText: question,
    };
  }

  return { plan: validated.plan, freeText: question };
}

export const ASSISTANT_CAPABILITIES = {
  requestTypes: [
    "Record search and counts",
    "Service call summaries",
    "Fleet / machine lookup",
    "PM / meter verification hints",
    "Inventory catalog search",
    "Technician open workload",
    "AI insight search",
    "Data quality center links",
  ],
  cannot: [
    "Modify operational records",
    "Execute arbitrary SQL",
    "Bypass module permissions",
    "Send external communications",
    "Approve financial activity",
  ],
  advisory: true,
  provider: "deterministic-matrix-search",
};
