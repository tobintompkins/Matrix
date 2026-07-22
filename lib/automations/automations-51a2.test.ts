/**
 * Patch 51A.2 — AI Automation Framework tests.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canAccessRoute,
  hasMatrixPermission,
} from "@/lib/auth/permissions";
import { resolvePath } from "@/lib/automations/engine/path";
import { evaluateConditionGroup } from "@/lib/automations/engine/evaluate-conditions";
import { requiresApproval } from "@/lib/automations/engine/approval-policy";
import { buildIdempotencyKey } from "@/lib/automations/engine/idempotency";
import { classifyAutomationCondition } from "@/lib/automations/ai/automation-ai";
import { SYSTEM_TEMPLATES } from "@/lib/automations/templates/system-templates";
import { listAvailableTriggers } from "@/lib/automations/registry/triggers";

describe("Patch 51A.2 permissions", () => {
  it("grants automation access to ADMIN and scoped manager perms", () => {
    assert.equal(hasMatrixPermission("ADMIN", "VIEW_AI_AUTOMATIONS"), true);
    assert.equal(hasMatrixPermission("ADMIN", "MANAGE_AI_AUTOMATION_SETTINGS"), true);
    assert.equal(hasMatrixPermission("SERVICE_MANAGER", "VIEW_AI_AUTOMATIONS"), true);
    assert.equal(hasMatrixPermission("SERVICE_MANAGER", "APPROVE_AI_AUTOMATIONS"), true);
    assert.equal(hasMatrixPermission("FIELD_TECHNICIAN", "CREATE_AI_AUTOMATIONS"), false);
  });

  it("gates automations route", () => {
    assert.equal(canAccessRoute("ADMIN", "/ai-operations/automations"), true);
    assert.equal(canAccessRoute("FIELD_TECHNICIAN", "/ai-operations/automations"), false);
  });
});

describe("Patch 51A.2 condition engine", () => {
  it("resolves nested paths safely without eval", () => {
    assert.equal(resolvePath({ a: { b: 2 } }, "a.b"), 2);
    assert.equal(resolvePath({ a: 1 }, "a.b.c"), undefined);
  });

  it("evaluates nested ALL/ANY groups", async () => {
    const result = await evaluateConditionGroup(
      {
        mode: "ANY",
        conditions: [
          { field: "priority", operator: "equals", value: "LOW" },
          {
            mode: "ALL",
            conditions: [
              { field: "priority", operator: "equals", value: "CRITICAL" },
              { field: "status", operator: "equals", value: "NEW" },
            ],
          },
        ],
      },
      { priority: "CRITICAL", status: "NEW" },
    );
    assert.equal(result.matched, true);
  });

  it("supports AI classification with structured confidence", async () => {
    const ai = await classifyAutomationCondition({
      type: "ai_classification",
      field: "problemDescription",
      value: "machine-down",
      payload: { problemDescription: "Production printer is completely offline" },
      minConfidence: 0.7,
    });
    assert.equal(ai.matched, true);
    assert.ok(ai.confidence >= 0.7);
  });
});

describe("Patch 51A.2 approval and idempotency", () => {
  it("requires approval for high-impact actions", () => {
    const r = requiresApproval({
      approvalMode: "BEFORE_HIGH_IMPACT_ACTION",
      riskLevel: "LOW",
      actions: [{ actionKey: "ai.draft_customer_communication" }],
      settingsHighImpactRequireApproval: true,
    });
    assert.equal(r.required, true);
  });

  it("builds stable idempotency keys", () => {
    const a = buildIdempotencyKey({
      automationId: "auto-1",
      triggerSource: "service_call.created",
      triggerReferenceId: "sc-1",
    });
    const b = buildIdempotencyKey({
      automationId: "auto-1",
      triggerSource: "service_call.created",
      triggerReferenceId: "sc-1",
    });
    assert.equal(a, b);
  });
});

describe("Patch 51A.2 templates and registry", () => {
  it("includes system templates for service, predictive, and decisions", () => {
    assert.ok(SYSTEM_TEMPLATES.length >= 10);
    const names = SYSTEM_TEMPLATES.map((t) => t.name);
    assert.ok(names.includes("Daily Decision Engine Refresh"));
    assert.ok(names.includes("Predictive Risk → Decision"));
  });

  it("exposes available triggers including service_call.created", () => {
    const keys = listAvailableTriggers().map((t) => t.key);
    assert.ok(keys.includes("service_call.created"));
    assert.ok(keys.includes("decision.daily_refresh"));
  });
});
