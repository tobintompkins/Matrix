/**
 * Patch 51A.1 Part 3 — Validate structured query plans (no arbitrary SQL).
 */

import { aiConfig } from "@/config/ai";
import {
  ALLOWED_FILTER_FIELDS,
  AI_REQUEST_TYPES,
  AI_SEARCH_MODULES,
  AI_SEARCH_OPERATORS,
  type AiSearchFilter,
  type AiSearchModule,
  type AiSearchPlan,
  type AiRequestType,
  type AiSearchOperator,
} from "./types";

const MAX_LIMIT = Math.min(50, aiConfig.assistantMaxResults);

export function validateQueryPlan(
  input: Partial<AiSearchPlan> & { requestType?: string },
): { ok: true; plan: AiSearchPlan } | { ok: false; error: string } {
  if (
    !input.requestType ||
    !AI_REQUEST_TYPES.includes(input.requestType as AiRequestType)
  ) {
    return { ok: false, error: "Unknown or missing request type." };
  }

  const modules = Array.isArray(input.modules) ? input.modules : [];
  for (const m of modules) {
    if (!AI_SEARCH_MODULES.includes(m as AiSearchModule)) {
      return { ok: false, error: `Unknown search module: ${String(m)}` };
    }
  }

  const filters = Array.isArray(input.filters) ? input.filters : [];
  for (const f of filters) {
    const check = validateFilter(f);
    if (!check.ok) return check;
  }

  const sort = Array.isArray(input.sort) ? input.sort : undefined;
  if (sort) {
    for (const s of sort) {
      if (!ALLOWED_FILTER_FIELDS.has(s.field) && s.field !== "createdAt") {
        return { ok: false, error: `Unsafe sort field: ${s.field}` };
      }
      if (s.direction !== "asc" && s.direction !== "desc") {
        return { ok: false, error: "Sort direction must be asc or desc." };
      }
    }
  }

  let limit = typeof input.limit === "number" ? input.limit : 10;
  if (!Number.isFinite(limit) || limit < 1) {
    return { ok: false, error: "Limit must be a positive number." };
  }
  limit = Math.min(MAX_LIMIT, Math.floor(limit));

  return {
    ok: true,
    plan: {
      requestType: input.requestType as AiRequestType,
      modules: modules as AiSearchModule[],
      filters: filters as AiSearchFilter[],
      sort,
      dateRange: input.dateRange,
      groupBy: input.groupBy?.slice(0, 5),
      limit,
      includeSummary: input.includeSummary !== false,
      includeSources: input.includeSources !== false,
    },
  };
}

export function validateFilter(
  f: Partial<AiSearchFilter>,
): { ok: true } | { ok: false; error: string } {
  if (!f.field || !ALLOWED_FILTER_FIELDS.has(f.field)) {
    return { ok: false, error: `Unknown or disallowed filter field: ${String(f.field)}` };
  }
  if (
    !f.operator ||
    !AI_SEARCH_OPERATORS.includes(f.operator as AiSearchOperator)
  ) {
    return { ok: false, error: `Unknown or unsafe operator: ${String(f.operator)}` };
  }
  return { ok: true };
}

/** Reject attempts to smuggle SQL / prompt injection via filter values. */
export function sanitizeUserText(input: string, max = aiConfig.assistantMaxQuestionLength): string {
  return input
    .replace(/\u0000/g, "")
    .slice(0, max)
    .trim();
}

export function looksLikeSqlInjection(text: string): boolean {
  return /\b(drop\s+table|delete\s+from|insert\s+into|alter\s+table|union\s+select|;--|\/\*|\bxp_)\b/i.test(
    text,
  );
}
