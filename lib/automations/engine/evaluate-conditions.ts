/**
 * Patch 51A.2 — Condition evaluation (no eval).
 */

import { resolvePath } from "./path";
import {
  classifyAutomationCondition,
} from "../ai/automation-ai";
import type {
  AutomationCondition,
  AutomationConditionGroup,
  ConditionEvalResult,
} from "../types";

function isGroup(
  c: AutomationCondition | AutomationConditionGroup,
): c is AutomationConditionGroup {
  return "mode" in c && Array.isArray((c as AutomationConditionGroup).conditions);
}

export async function evaluateConditionGroup(
  group: AutomationConditionGroup,
  payload: Record<string, unknown>,
  previous?: Record<string, unknown>,
): Promise<{ matched: boolean; results: ConditionEvalResult[] }> {
  const results: ConditionEvalResult[] = [];
  const outcomes: boolean[] = [];

  for (const item of group.conditions) {
    if (isGroup(item)) {
      const nested = await evaluateConditionGroup(item, payload, previous);
      results.push(...nested.results);
      outcomes.push(nested.matched);
    } else {
      const r = await evaluateCondition(item, payload, previous);
      results.push(r);
      outcomes.push(r.matched);
    }
  }

  const matched =
    group.mode === "ANY"
      ? outcomes.some(Boolean)
      : outcomes.every(Boolean) || outcomes.length === 0;

  return { matched, results };
}

export async function evaluateCondition(
  condition: AutomationCondition,
  payload: Record<string, unknown>,
  previous?: Record<string, unknown>,
): Promise<ConditionEvalResult> {
  const op = condition.operator;

  if (
    op === "ai_classification" ||
    op === "ai_risk_score" ||
    op === "ai_summary_match" ||
    op === "ai_anomaly_check"
  ) {
    const ai = await classifyAutomationCondition({
      type: op,
      field: condition.field,
      value: condition.value,
      payload,
      minConfidence: condition.minConfidence ?? 0.7,
    });
    return {
      matched: ai.matched,
      field: condition.field,
      operator: op,
      reason: ai.reason,
      confidence: ai.confidence,
      aiGenerated: true,
    };
  }

  const actual = resolvePath(payload, condition.field);
  const expected = condition.value;

  switch (op) {
    case "equals":
      return result(actual == expected, condition, `equals ${String(expected)}`);
    case "not_equals":
      return result(actual != expected, condition, `not equals ${String(expected)}`);
    case "contains":
      return result(
        String(actual ?? "").toLowerCase().includes(String(expected ?? "").toLowerCase()),
        condition,
        `contains ${String(expected)}`,
      );
    case "does_not_contain":
      return result(
        !String(actual ?? "").toLowerCase().includes(String(expected ?? "").toLowerCase()),
        condition,
        `does not contain ${String(expected)}`,
      );
    case "starts_with":
      return result(
        String(actual ?? "").toLowerCase().startsWith(String(expected ?? "").toLowerCase()),
        condition,
        `starts with ${String(expected)}`,
      );
    case "ends_with":
      return result(
        String(actual ?? "").toLowerCase().endsWith(String(expected ?? "").toLowerCase()),
        condition,
        `ends with ${String(expected)}`,
      );
    case "greater_than":
      return result(Number(actual) > Number(expected), condition, `> ${String(expected)}`);
    case "greater_than_or_equal":
      return result(Number(actual) >= Number(expected), condition, `>= ${String(expected)}`);
    case "less_than":
      return result(Number(actual) < Number(expected), condition, `< ${String(expected)}`);
    case "less_than_or_equal":
      return result(Number(actual) <= Number(expected), condition, `<= ${String(expected)}`);
    case "is_empty":
      return result(
        actual == null || actual === "" || (Array.isArray(actual) && actual.length === 0),
        condition,
        "is empty",
      );
    case "is_not_empty":
      return result(
        !(actual == null || actual === "" || (Array.isArray(actual) && actual.length === 0)),
        condition,
        "is not empty",
      );
    case "is_true":
      return result(actual === true || actual === "true", condition, "is true");
    case "is_false":
      return result(actual === false || actual === "false", condition, "is false");
    case "is_in": {
      const list = Array.isArray(expected) ? expected : String(expected ?? "").split(",");
      return result(list.map(String).includes(String(actual)), condition, "is in list");
    }
    case "is_not_in": {
      const list = Array.isArray(expected) ? expected : String(expected ?? "").split(",");
      return result(!list.map(String).includes(String(actual)), condition, "is not in list");
    }
    case "before":
      return result(
        new Date(String(actual)).getTime() < new Date(String(expected)).getTime(),
        condition,
        "before date",
      );
    case "after":
      return result(
        new Date(String(actual)).getTime() > new Date(String(expected)).getTime(),
        condition,
        "after date",
      );
    case "within_next_days": {
      const days = Number(expected);
      const t = new Date(String(actual)).getTime();
      const now = Date.now();
      const ok = t >= now && t <= now + days * 86400000;
      return result(ok, condition, `within next ${days} days`);
    }
    case "older_than_hours": {
      const hours = Number(expected);
      const t = new Date(String(actual)).getTime();
      return result(Date.now() - t > hours * 3600000, condition, `older than ${hours} hours`);
    }
    case "older_than_days": {
      const days = Number(expected);
      const t = new Date(String(actual)).getTime();
      return result(Date.now() - t > days * 86400000, condition, `older than ${days} days`);
    }
    case "changed_from": {
      const prev = previous ? resolvePath(previous, condition.field) : undefined;
      return result(String(prev) === String(expected), condition, `changed from ${String(expected)}`);
    }
    case "changed_to":
      return result(String(actual) === String(expected), condition, `changed to ${String(expected)}`);
    default:
      return {
        matched: false,
        field: condition.field,
        operator: op,
        reason: `Unknown operator ${op}`,
      };
  }
}

function result(
  matched: boolean,
  condition: AutomationCondition,
  reason: string,
): ConditionEvalResult {
  return {
    matched,
    field: condition.field,
    operator: condition.operator,
    reason,
  };
}
