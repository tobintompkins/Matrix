/**
 * Patch 51A.4 — Decision Engine unit tests (deterministic, no DB required for scoring).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildScores,
  computeOverallDecisionScore,
  priorityFromOverall,
  clampScore,
} from "./scoring";
import { canTransitionDecision, assertDecisionTransition } from "./transitions";
import { buildFingerprint } from "./persist";
import { DECISION_THRESHOLDS, DEFAULT_DECISION_WEIGHTS } from "./types";

describe("decision-engine scoring", () => {
  it("clamps scores to 0–100", () => {
    assert.equal(clampScore(-10), 0);
    assert.equal(clampScore(150), 100);
    assert.equal(clampScore(42.4), 42);
  });

  it("uses documented weighted formula", () => {
    const overall = computeOverallDecisionScore({
      riskScore: 100,
      urgencyScore: 0,
      businessImpactScore: 0,
      slaImpactScore: 0,
      confidenceScore: 0,
    });
    assert.equal(overall, 35);
    assert.equal(DEFAULT_DECISION_WEIGHTS.riskWeight, 0.35);
    assert.equal(DEFAULT_DECISION_WEIGHTS.urgencyWeight, 0.25);
  });

  it("maps overall to priority thresholds", () => {
    assert.equal(priorityFromOverall(DECISION_THRESHOLDS.criticalOverall), "CRITICAL");
    assert.equal(priorityFromOverall(DECISION_THRESHOLDS.highOverall), "HIGH");
    assert.equal(priorityFromOverall(DECISION_THRESHOLDS.mediumOverall), "MEDIUM");
    assert.equal(priorityFromOverall(10), "INFORMATIONAL");
  });

  it("buildScores fills overall", () => {
    const s = buildScores({
      riskScore: 80,
      urgencyScore: 60,
      businessImpactScore: 40,
      confidenceScore: 90,
      slaImpactScore: 50,
    });
    assert.ok(s.overallDecisionScore >= 0 && s.overallDecisionScore <= 100);
  });
});

describe("decision-engine transitions", () => {
  it("allows approve from NEW / REVIEW_REQUIRED", () => {
    assert.equal(canTransitionDecision("NEW", "APPROVED"), true);
    assert.equal(canTransitionDecision("REVIEW_REQUIRED", "REJECTED"), true);
    assert.equal(canTransitionDecision("COMPLETED", "APPROVED"), false);
  });

  it("rejects invalid transitions with message", () => {
    const r = assertDecisionTransition("COMPLETED", "NEW");
    assert.equal(r.ok, false);
  });

  it("requires reject reason at API layer — transition itself is valid", () => {
    assert.equal(canTransitionDecision("NEW", "REJECTED"), true);
  });
});

describe("decision-engine fingerprint", () => {
  it("is stable for same type/source", () => {
    const a = buildFingerprint("SLA_RISK", "ServiceCall", "sc-1", "M1");
    const b = buildFingerprint("SLA_RISK", "ServiceCall", "sc-1", "M1");
    assert.equal(a, b);
    assert.notEqual(
      a,
      buildFingerprint("SLA_RISK", "ServiceCall", "sc-2", "M1"),
    );
  });
});

describe("decision-engine AI separation", () => {
  it("does not let explanation change deterministic overall", async () => {
    const { explainDecisionDeterministic } = await import("./ai-explain");
    const scores = buildScores({
      riskScore: 70,
      urgencyScore: 70,
      businessImpactScore: 70,
      confidenceScore: 70,
      slaImpactScore: 70,
    });
    const draft = {
      decisionType: "OTHER" as const,
      title: "t",
      summary: "s",
      detailedReasoning: "d",
      sourceType: "Test",
      fingerprint: "x",
      priority: priorityFromOverall(scores.overallDecisionScore),
      scores,
      recommendedAction: "Review",
      alternativeActions: [],
      evidence: {
        generatedAt: new Date().toISOString(),
        facts: [{ label: "A", value: 1, available: true }],
        ruleMatches: [],
        links: [],
      },
      highImpact: false,
    };
    const before = scores.overallDecisionScore;
    await explainDecisionDeterministic(draft);
    assert.equal(draft.scores.overallDecisionScore, before);
  });
});
