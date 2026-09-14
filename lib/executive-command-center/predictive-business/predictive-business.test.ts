/**
 * Patch 51C.2 — Predictive Business Analytics unit tests.
 * Aligns with official 02_IMPLEMENTATION_SPEC preferred methods.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  movingAverage,
  weightedMovingAverage,
  linearTrendNext,
  seasonalComparisonNext,
  pickBaselineForecast,
  confidenceFromHistory,
} from "./forecasting";
import { FORECAST_METHOD_VERSION } from "./types";
import { getServiceDemandForecast } from "./service-demand";
import { getPartsDemandForecast } from "./parts-demand";
import { runScenarioPlanner } from "./scenario-planner";
import {
  setCustomerRiskOverride,
  getCustomerRiskOverride,
  getCustomerOperationalRisk,
} from "./customer-operational-risk";
import { isPredictiveBusinessAnalytics51c2Enabled } from "../feature-flag";
import { hasMatrixPermission } from "@/lib/auth/permissions";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

describe("predictive business forecasting helpers", () => {
  it("supports MA, WMA, linear trend, and seasonal comparison", () => {
    assert.equal(movingAverage([1, 2, 3, 4], 4), 2.5);
    assert.ok(weightedMovingAverage([1, 2, 3, 4], 4)! > movingAverage([1, 2, 3, 4], 4)!);
    assert.equal(movingAverage([], 4), null);
    const trend = linearTrendNext([1, 2, 3, 4, 5, 6]);
    assert.ok(trend != null && trend > 5);
    const seasonal = seasonalComparisonNext(
      [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33],
      12,
    );
    assert.ok(seasonal != null);
    const insuff = pickBaselineForecast([1]);
    assert.equal(insuff.method, "insufficient_data");
    assert.equal(insuff.value, null);
    assert.equal(insuff.low, null);
  });

  it("withholds confidence and bounds when history is thin", () => {
    const low = confidenceFromHistory(1, 1);
    assert.equal(low.confidence, null);
    assert.equal(low.sufficient, false);
    const ok = confidenceFromHistory(50, 6);
    assert.ok(ok.confidence != null && ok.confidence > 50);
  });
});

describe("predictive business domain forecasts", () => {
  it("emits spec forecast-result fields and separates actuals", () => {
    const f = getServiceDemandForecast({ horizon: "MONTH" });
    assert.equal(f.meta.methodVersion, FORECAST_METHOD_VERSION);
    assert.ok(f.meta.metric);
    assert.ok(f.meta.scope);
    assert.ok(f.meta.generatedAt);
    assert.ok(typeof f.meta.dataSufficient === "boolean");
    assert.ok(f.meta.assumptions.length > 0);
    for (const p of f.series) {
      if (p.forecast != null) assert.equal(p.actual, null);
      if (p.actual != null) assert.equal(p.forecast, null);
    }
  });

  it("parts demand uses consumption-rate framing and never auto-orders", () => {
    const f = getPartsDemandForecast({ horizon: "WEEK" });
    assert.ok(
      f.meta.assumptions.some((a) => /never creates purchase orders/i.test(a)),
    );
    assert.ok(
      f.meta.method === "consumption_rate" ||
        f.meta.method === "insufficient_data",
    );
  });

  it("scenario planner never mutates and requires confirmation", async () => {
    const s = await runScenarioPlanner({
      label: "test",
      assumptions: { serviceDemandDeltaPct: 20 },
    });
    assert.equal(s.mutatesLiveRecords, false);
    assert.equal(s.requiresUserConfirmation, true);
    assert.ok(s.warnings.some((w) => /what-if only/i.test(w)));
  });

  it("customer service health override requires note", async () => {
    const bad = await setCustomerRiskOverride({
      customerId: "cust-test",
      score: 40,
      note: "",
      actorId: "tester",
    });
    assert.equal(bad.ok, false);
    const good = await setCustomerRiskOverride({
      organizationId: "org-sfx",
      customerId: "cust-test",
      score: 40,
      note: "Temporary watch due to open critical calls",
      actorId: "tester",
    });
    assert.equal(good.ok, true);
    if (good.ok) {
      assert.equal(good.override.score, 40);
      const ov = getCustomerRiskOverride("org-sfx", "cust-test");
      assert.equal(ov?.score, 40);
    }
  });

  it("feature flag defaults enabled", () => {
    assert.equal(isPredictiveBusinessAnalytics51c2Enabled(), true);
  });

  it("customer service health is internal and explainable; portal APIs do not import it", async () => {
    assert.equal(
      hasMatrixPermission("FIELD_TECHNICIAN", "VIEW_EXECUTIVE_COMMAND_CENTER"),
      false,
    );
    assert.equal(
      hasMatrixPermission("ADMIN", "VIEW_EXECUTIVE_ANALYTICS") ||
        hasMatrixPermission("ADMIN", "VIEW_EXECUTIVE_COMMAND_CENTER"),
      true,
    );
    const risk = await getCustomerOperationalRisk({ organizationId: "org-sfx" });
    assert.equal(risk.meta.scope, "internal_executive_only");
    assert.ok(
      risk.meta.assumptions.some((a) => /must not enter customer-facing/i.test(a)),
    );
    for (const row of risk.customers.slice(0, 3)) {
      assert.ok(Array.isArray(row.factors));
    }
    const portalApiRoot = join(process.cwd(), "app", "api", "portal");
    const walk = (dir: string): string[] => {
      const out: string[] = [];
      for (const ent of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, ent.name);
        if (ent.isDirectory()) out.push(...walk(p));
        else if (ent.name.endsWith(".ts") || ent.name.endsWith(".tsx")) out.push(p);
      }
      return out;
    };
    for (const file of walk(portalApiRoot)) {
      const src = readFileSync(file, "utf8");
      assert.equal(
        /predictive-business|customer-operational-risk|getCustomerOperationalRisk/.test(
          src,
        ),
        false,
        `portal API must not import PBA customer health: ${file}`,
      );
    }
  });
});
