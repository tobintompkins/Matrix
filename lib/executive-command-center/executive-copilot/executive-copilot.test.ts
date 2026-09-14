/**
 * Patch 51C.3 — Executive AI Copilot tests.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { hasMatrixPermission } from "@/lib/auth/permissions";
import { isExecutiveAiCopilot51c3Enabled } from "../feature-flag";
import { listExecutiveDashboardWidgets } from "./widgets";
import { getExecutiveDecisionSupport } from "./decision-support";
import { answerExecutiveCopilot, listCopilotPresets } from "./answer";
import { buildDailyExecutiveBriefing } from "./daily-briefing";
import { buildWeeklyExecutiveReport } from "./weekly-report";

describe("executive ai copilot 51C.3", () => {
  it("feature flag defaults enabled", () => {
    assert.equal(isExecutiveAiCopilot51c3Enabled(), true);
  });

  it("exposes the required executive widget catalog without a new dashboard product", () => {
    const keys = listExecutiveDashboardWidgets().map((w) => w.key);
    for (const k of [
      "executiveSummary",
      "fleetHealth",
      "serviceTrends",
      "customerHealth",
      "revenueDashboard",
      "costDashboard",
      "inventoryHealth",
      "technicianPerformance",
      "aiInsights",
      "forecastAlerts",
    ]) {
      assert.ok(keys.includes(k), `missing widget ${k}`);
    }
    assert.ok(
      listExecutiveDashboardWidgets().every((w) =>
        w.href.startsWith("/") && !w.href.includes("/copilot-dashboard"),
      ),
    );
  });

  it("includes leadership question presets", () => {
    const labels = listCopilotPresets().map((p) => p.label);
    assert.ok(labels.some((l) => /operational risk/i.test(l)));
    assert.ok(labels.some((l) => /costing/i.test(l)));
    assert.ok(labels.some((l) => /PM compliance/i.test(l)));
    assert.ok(labels.some((l) => /reorder/i.test(l)));
  });

  it("answers with confidence, records, reports, assumptions, and never fabricates", async () => {
    const a = await answerExecutiveCopilot({
      question: "What parts should we reorder?",
    });
    assert.equal(a.fabricated, false);
    assert.ok(typeof a.confidence === "number");
    assert.ok(a.confidence >= 0 && a.confidence <= 100);
    assert.ok(Array.isArray(a.supportingRecords));
    assert.ok(Array.isArray(a.relatedReports));
    assert.ok(a.assumptions.length > 0);
    assert.ok(a.answer.length > 0);
  });

  it("decision support never executes", async () => {
    const d = await getExecutiveDecisionSupport();
    assert.equal(d.executable, false);
    assert.ok(d.recommendations.length > 0);
    for (const r of d.recommendations) {
      assert.equal(r.executable, false);
      assert.equal(r.requiresUserConfirmation, true);
    }
  });

  it("daily briefing and weekly report fields are populated", async () => {
    const daily = await buildDailyExecutiveBriefing();
    assert.ok(daily.todaysPriorities);
    assert.ok(daily.machineDownSummary);
    assert.ok(daily.pmCompliance);
    assert.ok(daily.recommendedActions.every((r) => r.executable === false));
    const weekly = await buildWeeklyExecutiveReport();
    assert.ok(weekly.serviceMetrics.length > 0);
    assert.ok(weekly.pmMetrics.length > 0);
    assert.ok(weekly.href.includes("report-center"));
  });

  it("permissions: executives/managers yes; technicians and customers no", () => {
    assert.equal(
      hasMatrixPermission("ADMIN", "USE_EXECUTIVE_AI_INSIGHTS"),
      true,
    );
    assert.equal(
      hasMatrixPermission("DIRECTOR", "USE_EXECUTIVE_AI_INSIGHTS"),
      true,
    );
    assert.equal(
      hasMatrixPermission("SERVICE_MANAGER", "USE_EXECUTIVE_AI_INSIGHTS"),
      true,
    );
    assert.equal(
      hasMatrixPermission("FIELD_TECHNICIAN", "VIEW_EXECUTIVE_COMMAND_CENTER"),
      false,
    );
    assert.equal(
      hasMatrixPermission("CUSTOMER_ADMIN", "USE_EXECUTIVE_AI_INSIGHTS"),
      false,
    );
  });

  it("portal APIs do not import executive copilot", () => {
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
        /executive-copilot|answerExecutiveCopilot|getExecutiveCopilotBundle/.test(
          src,
        ),
        false,
        `portal must not import copilot: ${file}`,
      );
    }
  });
});
