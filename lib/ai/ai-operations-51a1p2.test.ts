/**
 * Patch 51A.1 Part 2 — AI Operations dashboard / workflow tests.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canAccessRoute,
  hasMatrixPermission,
} from "@/lib/auth/permissions";
import { canTransition } from "@/lib/ai/insight-workflow";
import { AI_INSIGHT_TYPES } from "@/lib/ai/insight-types";
import { collectCandidates } from "@/lib/ai/analysis-runner";
import { getAiOperationsDashboard, getAiOperationsTrends } from "@/lib/ai/dashboard";
import { aiConfig } from "@/config/ai";

describe("Patch 51A.1 Part 2 permissions", () => {
  it("grants AI operations permissions to ADMIN / SUPER_ADMIN only", () => {
    assert.equal(hasMatrixPermission("ADMIN", "VIEW_AI_OPERATIONS"), true);
    assert.equal(hasMatrixPermission("SUPER_ADMIN", "MANAGE_AI_OPERATIONS"), true);
    assert.equal(hasMatrixPermission("ADMIN", "RUN_AI_ANALYSIS"), true);
    assert.equal(hasMatrixPermission("ADMIN", "RESOLVE_AI_INSIGHTS"), true);
    assert.equal(hasMatrixPermission("FIELD_TECHNICIAN", "VIEW_AI_OPERATIONS"), false);
    assert.equal(hasMatrixPermission("CUSTOMER_USER", "RUN_AI_ANALYSIS"), false);
  });

  it("gates /ai-operations route", () => {
    assert.equal(canAccessRoute("ADMIN", "/ai-operations"), true);
    assert.equal(canAccessRoute("FIELD_TECHNICIAN", "/ai-operations"), false);
  });

  it("keeps Part 1 /ai route working", () => {
    assert.equal(canAccessRoute("ADMIN", "/ai"), true);
  });
});

describe("Patch 51A.1 Part 2 status transitions", () => {
  it("allows documented workflow paths and rejects invalid ones", () => {
    assert.equal(canTransition("NEW", "REVIEWING"), true);
    assert.equal(canTransition("NEW", "DISMISSED"), true);
    assert.equal(canTransition("REVIEWING", "ACKNOWLEDGED"), true);
    assert.equal(canTransition("ACKNOWLEDGED", "ACTION_REQUIRED"), true);
    assert.equal(canTransition("ACTION_REQUIRED", "RESOLVED"), true);
    assert.equal(canTransition("RESOLVED", "ARCHIVED"), true);
    assert.equal(canTransition("DISMISSED", "NEW"), true);
    assert.equal(canTransition("RESOLVED", "NEW"), false);
    assert.equal(canTransition("ARCHIVED", "NEW"), false);
  });

  it("defines structured insight types", () => {
    assert.ok(AI_INSIGHT_TYPES.includes("REPEAT_FAILURE"));
    assert.ok(AI_INSIGHT_TYPES.includes("INVENTORY_RISK"));
    assert.ok(AI_INSIGHT_TYPES.includes("DATA_QUALITY"));
  });
});

describe("Patch 51A.1 Part 2 analysis candidates", () => {
  it("builds candidates from real Matrix data without inventing operational rows", async () => {
    const result = await collectCandidates();
    assert.ok(result.analyzed >= 0);
    assert.ok(Array.isArray(result.candidates));
    assert.ok(result.candidates.length >= 1);
    for (const c of result.candidates) {
      assert.ok(c.title.length > 0);
      assert.ok(c.confidence >= 0 && c.confidence <= 100);
      assert.ok(c.limitations.length > 0);
    }
  });
});

describe("Patch 51A.1 Part 2 dashboard", () => {
  it("returns summary cards and advisory notice from stored/computed data", async () => {
    const dash = await getAiOperationsDashboard();
    assert.ok(typeof dash.activeInsights === "number");
    assert.ok(dash.advisoryNotice.includes("advisory"));
    assert.ok(dash.briefing.text.length > 0);
    assert.ok(dash.moduleCounts);
    assert.equal(typeof dash.coverage.machinesAnalyzed, "number");
  });

  it("returns empty trend state when no insights exist in range", async () => {
    const trends = await getAiOperationsTrends("org-that-does-not-exist-51a1p2", 7);
    assert.equal(trends.empty, true);
    assert.ok(Array.isArray(trends.series));
  });

  it("does not expose secrets in AI config surface", () => {
    const json = JSON.stringify(aiConfig);
    assert.equal(/api[_-]?key|secret|sk-/i.test(json), false);
  });
});
