/**
 * Patch 50C-1 — Data Quality Center unit tests.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyDataHealth,
  computeDataHealthScore,
  DEFAULT_DQ_SETTINGS,
  normalizeKey,
  validateDimensionWeights,
} from "./score";
import { safeNormalizeEmailPreview } from "./fixes";
import { hasMatrixPermission } from "@/lib/auth/permissions";
import { SYSTEM_RULES } from "./rules";

describe("data quality score engine", () => {
  it("classifies scores using thresholds", () => {
    assert.equal(classifyDataHealth(96), "Excellent");
    assert.equal(classifyDataHealth(90), "Healthy");
    assert.equal(classifyDataHealth(75), "Needs Attention");
    assert.equal(classifyDataHealth(55), "At Risk");
    assert.equal(classifyDataHealth(20), "Critical");
    assert.equal(classifyDataHealth(null), "Not Available");
  });

  it("validates and normalizes dimension weights", () => {
    const result = validateDimensionWeights(DEFAULT_DQ_SETTINGS.dimensionWeights);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const sum = Object.values(result.normalized).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 100) < 0.05);
  });

  it("computes weighted score and ignores unavailable dimensions", () => {
    const score = computeDataHealthScore(
      [
        {
          dimension: "completeness",
          score: 80,
          available: true,
          openIssues: 2,
          criticalIssues: 0,
        },
        {
          dimension: "validity",
          score: 90,
          available: true,
          openIssues: 1,
          criticalIssues: 0,
        },
        {
          dimension: "uniqueness",
          score: null,
          available: false,
          openIssues: 0,
          criticalIssues: 0,
        },
        {
          dimension: "relationshipIntegrity",
          score: 70,
          available: true,
          openIssues: 3,
          criticalIssues: 1,
        },
        {
          dimension: "timeliness",
          score: 100,
          available: true,
          openIssues: 0,
          criticalIssues: 0,
        },
      ],
      DEFAULT_DQ_SETTINGS,
    );
    assert.ok(score.overallScore != null);
    assert.notEqual(score.classification, "Insufficient Data");
    assert.equal(score.calculationVersion.startsWith("50C1"), true);
  });

  it("returns insufficient data when nothing is available", () => {
    const score = computeDataHealthScore(
      [
        {
          dimension: "completeness",
          score: null,
          available: false,
          openIssues: 0,
          criticalIssues: 0,
        },
      ],
      DEFAULT_DQ_SETTINGS,
    );
    assert.equal(score.overallScore, null);
    assert.equal(score.classification, "Insufficient Data");
  });
});

describe("data quality normalization", () => {
  it("normalizes keys for duplicate detection", () => {
    assert.equal(normalizeKey(" ABC-123 "), "abc123");
    assert.equal(normalizeKey("Acme, Inc."), "acmeinc");
  });

  it("normalizes emails safely for preview", () => {
    assert.equal(safeNormalizeEmailPreview("  Foo@Example.COM "), "foo@example.com");
  });
});

describe("data quality permissions", () => {
  it("denies field technician by default", () => {
    assert.equal(
      hasMatrixPermission("FIELD_TECHNICIAN", "VIEW_DATA_QUALITY_CENTER"),
      false,
    );
    assert.equal(
      hasMatrixPermission("FIELD_TECHNICIAN", "MERGE_DUPLICATE_RECORDS"),
      false,
    );
  });

  it("allows admin full access", () => {
    assert.equal(
      hasMatrixPermission("ADMIN", "VIEW_DATA_QUALITY_CENTER"),
      true,
    );
    assert.equal(hasMatrixPermission("ADMIN", "MERGE_DUPLICATE_RECORDS"), true);
    assert.equal(hasMatrixPermission("ADMIN", "RUN_DATA_QUALITY_SCAN"), true);
  });
});

describe("system rules seed list", () => {
  it("includes required starter rules", () => {
    const codes = new Set(SYSTEM_RULES.map((r) => r.code));
    for (const code of [
      "DUP_CUSTOMER_ACCOUNT",
      "DUP_MACHINE_SERIAL",
      "DUP_PART_NUMBER",
      "MISS_CUSTOMER_NAME",
      "MISS_MACHINE_SERIAL",
      "INV_NEGATIVE_ON_HAND",
      "PORTAL_USER_NO_CUSTOMER",
      "APPROVAL_PENDING_NO_STEP",
    ]) {
      assert.equal(codes.has(code), true, `missing ${code}`);
    }
  });
});
