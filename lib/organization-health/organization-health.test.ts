/**
 * Patch 50B — Organization Health unit tests.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyScore,
  computeOverallHealthScore,
  DEFAULT_HEALTH_SETTINGS,
  safePercentChange,
  validateWeights,
} from "./score";
import { hasMatrixPermission } from "@/lib/auth/permissions";

describe("organization health score engine", () => {
  it("classifies scores using thresholds", () => {
    assert.equal(classifyScore(95), "Excellent");
    assert.equal(classifyScore(85), "Healthy");
    assert.equal(classifyScore(75), "Watch");
    assert.equal(classifyScore(65), "At Risk");
    assert.equal(classifyScore(40), "Critical");
    assert.equal(classifyScore(null), "Not Available");
  });

  it("normalizes weights when categories are disabled", () => {
    const enabled = { ...DEFAULT_HEALTH_SETTINGS.enabledCategories, financial: false, security: false };
    const result = validateWeights(DEFAULT_HEALTH_SETTINGS.weights, enabled);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const sum = Object.values(result.normalized).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 100) < 0.01);
    assert.equal(result.normalized.financial, 0);
  });

  it("computes weighted overall score and ignores missing categories", () => {
    const score = computeOverallHealthScore(
      [
        { key: "fleet", score: 80, available: true },
        { key: "service", score: 90, available: true },
        { key: "pm", score: null, available: false },
        { key: "inventory", score: 70, available: true },
        { key: "technician", score: 60, available: true },
        { key: "customer", score: 50, available: true },
        { key: "financial", score: null, available: false },
        { key: "security", score: 100, available: true },
      ],
      DEFAULT_HEALTH_SETTINGS,
      "2026-07-14T00:00:00.000Z",
    );
    assert.ok(score.overallScore != null);
    assert.notEqual(score.classification, "Insufficient Data");
    assert.equal(score.calculationVersion.startsWith("50B"), true);
    // Missing categories must not force overall to zero
    assert.ok((score.overallScore as number) > 40);
  });

  it("returns insufficient data when nothing is available", () => {
    const score = computeOverallHealthScore(
      [{ key: "fleet", score: null, available: false }],
      {
        ...DEFAULT_HEALTH_SETTINGS,
        enabledCategories: {
          fleet: true,
          service: false,
          pm: false,
          inventory: false,
          technician: false,
          customer: false,
          financial: false,
          security: false,
        },
      },
    );
    assert.equal(score.overallScore, null);
    assert.equal(score.classification, "Insufficient Data");
  });

  it("handles percent change safely when previous is zero", () => {
    assert.equal(safePercentChange(5, 0).label, "New");
    assert.equal(safePercentChange(0, null).label, "No Previous Data");
  });
});

describe("organization health permissions", () => {
  it("grants administrators and blocks technicians by default", () => {
    assert.equal(hasMatrixPermission("ADMIN", "VIEW_ORGANIZATION_HEALTH"), true);
    assert.equal(
      hasMatrixPermission("SERVICE_MANAGER", "VIEW_ORGANIZATION_HEALTH"),
      true,
    );
    assert.equal(
      hasMatrixPermission("FIELD_TECHNICIAN", "VIEW_ORGANIZATION_HEALTH"),
      false,
    );
    assert.equal(
      hasMatrixPermission("WAREHOUSE_MANAGER", "VIEW_INVENTORY_HEALTH"),
      true,
    );
  });
});
