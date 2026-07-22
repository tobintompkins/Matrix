/**
 * Patch 51A.5 — Executive Command Center unit tests (Parts 1 & 2).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  classifyFleetHealth,
  computeExecutiveFleetHealth,
} from "./fleet-health";
import { prioritySortKey, sortExecutivePriorities } from "./priorities";
import { buildExecutiveBriefing } from "./briefing";
import type { ExecutivePriorityItem } from "./types";
import { hasMatrixPermission } from "@/lib/auth/permissions";
import {
  parseExecutiveRange,
  rangeToDays,
  isIsoInRange,
} from "./date-range";
import { analyticsToCsv } from "./analytics";
import type { ExecutiveAnalyticsPayload } from "./analytics-types";
import { periodWindows, parseReportPeriod } from "./reporting";
import {
  buildExecutiveReportCsv,
  exportExecutiveReport,
} from "./export-engine";
import type { PeriodReportBundle } from "./reporting-types";

describe("executive fleet health", () => {
  it("withholds score when no active machines", () => {
    const r = computeExecutiveFleetHealth({
      activeMachines: 0,
      criticalServiceCalls: 0,
      openServiceCalls: 0,
      pmOverdue: 0,
      machinesAtRisk: 0,
      criticalAlerts: 0,
      dataFreshnessScore: 80,
    });
    assert.equal(r.score, null);
    assert.equal(r.status, "unknown");
  });

  it("penalizes critical calls and remains explainable", () => {
    const healthy = computeExecutiveFleetHealth({
      activeMachines: 10,
      criticalServiceCalls: 0,
      openServiceCalls: 1,
      pmOverdue: 0,
      machinesAtRisk: 0,
      criticalAlerts: 0,
      dataFreshnessScore: 90,
    });
    const stressed = computeExecutiveFleetHealth({
      activeMachines: 10,
      criticalServiceCalls: 3,
      openServiceCalls: 8,
      pmOverdue: 4,
      machinesAtRisk: 2,
      criticalAlerts: 2,
      dataFreshnessScore: 90,
    });
    assert.ok((healthy.score ?? 0) > (stressed.score ?? 0));
    assert.ok(stressed.factors.some((f) => f.key === "criticalServiceCalls"));
    assert.equal(classifyFleetHealth(95), "excellent");
    assert.equal(classifyFleetHealth(50), "critical");
  });
});

describe("executive priority sorting", () => {
  it("ranks critical before high and applies overdue boost", () => {
    const items: ExecutivePriorityItem[] = [
      {
        id: "a",
        severity: "HIGH",
        title: "High",
        reason: "r",
        recommendedNextStep: "n",
        href: "/",
        source: "Service",
        sortKey: prioritySortKey("HIGH", false, "2026-01-01T00:00:00.000Z"),
      },
      {
        id: "b",
        severity: "CRITICAL",
        title: "Critical",
        reason: "r",
        recommendedNextStep: "n",
        href: "/",
        source: "Service",
        sortKey: prioritySortKey("CRITICAL", true, "2026-01-01T00:00:00.000Z"),
      },
      {
        id: "c",
        severity: "MEDIUM",
        title: "Medium",
        reason: "r",
        recommendedNextStep: "n",
        href: "/",
        source: "Automation",
        sortKey: prioritySortKey("MEDIUM", false, "2026-07-01T00:00:00.000Z"),
      },
    ];
    const sorted = sortExecutivePriorities(items);
    assert.equal(sorted[0]?.id, "b");
    assert.ok((sorted[0]?.sortKey ?? 0) > (sorted[1]?.sortKey ?? 0));
  });
});

describe("executive briefing sample mode", () => {
  it("returns sample briefing and does not crash on empty", () => {
    const empty = buildExecutiveBriefing({
      kpis: {
        activeMachines: 0,
        openServiceCalls: 0,
        criticalServiceCalls: 0,
        machinesAtRisk: 0,
        pmDue: 0,
        pmOverdue: 0,
        criticalAlerts: 0,
        activeTechnicians: 0,
        technicianCoverageLabel: "none",
      },
      fleetHealth: {
        score: null,
        status: "unknown",
        confidence: 0,
        factors: [],
      },
      priorities: [],
    });
    assert.equal(empty.isSample, true);
    assert.equal(empty.insufficientData, true);

    const filled = buildExecutiveBriefing({
      kpis: {
        activeMachines: 5,
        openServiceCalls: 2,
        criticalServiceCalls: 1,
        machinesAtRisk: 1,
        pmDue: 2,
        pmOverdue: 1,
        criticalAlerts: 1,
        activeTechnicians: 2,
        technicianCoverageLabel: "2 available of 3",
      },
      fleetHealth: {
        score: 72,
        status: "watch",
        confidence: 70,
        factors: [],
      },
      priorities: [
        {
          id: "1",
          severity: "CRITICAL",
          title: "Down machine",
          reason: "Production impact",
          recommendedNextStep: "Dispatch technician",
          href: "/service-calls",
          source: "Service",
          sortKey: 500,
        },
      ],
    });
    assert.equal(filled.isSample, true);
    assert.ok(filled.priorities.length <= 5);
    assert.ok(filled.summary.includes("72"));
  });
});

describe("executive command center permissions", () => {
  it("grants admin/manager and denies technician by default", () => {
    assert.equal(
      hasMatrixPermission("ADMIN", "VIEW_EXECUTIVE_COMMAND_CENTER"),
      true,
    );
    assert.equal(
      hasMatrixPermission("SERVICE_MANAGER", "VIEW_EXECUTIVE_COMMAND_CENTER"),
      true,
    );
    assert.equal(
      hasMatrixPermission("FIELD_TECHNICIAN", "VIEW_EXECUTIVE_COMMAND_CENTER"),
      false,
    );
  });
});

describe("executive analytics date range (Part 2)", () => {
  it("parses ranges and day windows", () => {
    assert.equal(parseExecutiveRange("last_7"), "LAST_7");
    assert.equal(parseExecutiveRange("bogus"), "LAST_30");
    assert.equal(rangeToDays("TODAY"), 1);
    assert.equal(rangeToDays("LAST_30"), 30);
    assert.ok(isIsoInRange(new Date().toISOString(), "LAST_30"));
    assert.equal(isIsoInRange("1999-01-01T00:00:00.000Z", "TODAY"), false);
  });

  it("builds CSV from analytics payload", () => {
    const payload = {
      generatedAt: "2026-07-17T00:00:00.000Z",
      range: "LAST_30",
      rangeLabel: "Last 30 days",
      days: 30,
      dataCompleteness: 50,
      empty: false,
      emptyMessage: null,
      kpiTrends: {
        current: {
          openServiceCalls: 1,
          criticalServiceCalls: 0,
          pmOverdue: 0,
          machinesAtRisk: 0,
          activeTechnicians: 1,
          fleetHealthScore: 80,
          openDecisions: 0,
        },
        series: [],
        seriesEmpty: true,
      },
      technicians: [
        {
          name: "Toby",
          status: "AVAILABLE",
          openCalls: 1,
          criticalCalls: 0,
          workloadHours: 2,
          territory: "ME",
          href: "/dispatch",
        },
      ],
      customers: [],
      predictive: {
        machinesEvaluated: 0,
        highRisk: 0,
        criticalRisk: 0,
        openAlerts: 0,
        dueSoon14d: 0,
        topRiskMachines: [],
      },
      aiInsights: {
        active: 0,
        critical: 0,
        pendingReview: 0,
        trendEmpty: true,
        series: [],
        topInsights: [],
      },
      reports: [
        {
          key: "service",
          title: "Service",
          summary: "ok",
          metrics: [{ label: "Open", value: "1" }],
          href: "/service-calls",
        },
      ],
      drilldowns: [],
    } satisfies ExecutiveAnalyticsPayload;
    const csv = analyticsToCsv(payload);
    assert.ok(csv.includes("section,label,value"));
    assert.ok(csv.includes("technician"));
    assert.ok(csv.includes("Open"));
  });
});

describe("executive reporting Part 3", () => {
  it("parses periods and builds windows", () => {
    assert.equal(parseReportPeriod("daily"), "DAILY");
    assert.equal(parseReportPeriod("nope"), "WEEKLY");
    const w = periodWindows("WEEKLY", new Date("2026-07-17T12:00:00.000Z"));
    assert.ok(w.current.start.getTime() < w.current.end.getTime());
    assert.ok(w.previous.end.getTime() <= w.current.start.getTime());
  });

  it("parses executive filters and briefing period", async () => {
    const { parseExecutiveFilters } = await import("./filters");
    const { parseBriefingPeriod } = await import("./briefing-center");
    const f = parseExecutiveFilters({
      customer: "Acme",
      site: "",
      status: "OPEN",
    });
    assert.equal(f.customer, "Acme");
    assert.equal(f.site, undefined);
    assert.equal(f.status, "OPEN");
    assert.equal(parseBriefingPeriod("monthly"), "MONTHLY");
    assert.equal(parseBriefingPeriod("x"), "DAILY");
  });

  it("rate-limits expensive executive endpoints", async () => {
    const {
      checkExecutiveRateLimit,
      _resetExecutiveRateLimits,
    } = await import("./rate-limit");
    _resetExecutiveRateLimits();
    for (let i = 0; i < 3; i += 1) {
      assert.equal(checkExecutiveRateLimit("test-key", 3).ok, true);
    }
    assert.equal(checkExecutiveRateLimit("test-key", 3).ok, false);
  });

  it("exports csv/excel/pdf without inventing scorecard values", () => {
    const bundle: PeriodReportBundle = {
      period: "WEEKLY",
      periodLabel: "Weekly report",
      generatedAt: "2026-07-17T00:00:00.000Z",
      window: {
        start: "2026-07-11T00:00:00.000Z",
        end: "2026-07-18T00:00:00.000Z",
      },
      previousWindow: {
        start: "2026-07-04T00:00:00.000Z",
        end: "2026-07-11T00:00:00.000Z",
      },
      scorecards: [
        {
          key: "fleetHealth",
          label: "Fleet Health",
          value: null,
          unit: "score",
          status: "unavailable",
          detail: "No active machines",
          available: false,
        },
      ],
      comparisons: [
        {
          metric: "Calls created",
          current: 2,
          previous: 1,
          delta: 1,
          deltaPercent: 100,
          direction: "up",
        },
      ],
      widgets: [],
      aiSummary: {
        summary: "Sample summary",
        sections: [],
        generatedAt: "2026-07-17T00:00:00.000Z",
        isSample: true,
        provider: "matrix-local",
        model: "test",
        confidence: 40,
      },
      highlights: ["hi"],
      cacheHit: false,
    };
    const csv = buildExecutiveReportCsv(bundle);
    assert.ok(csv.includes("unavailable") || csv.includes("Fleet Health"));
    const excel = exportExecutiveReport(bundle, "excel");
    assert.ok(excel.filename.endsWith(".xls"));
    const pdf = exportExecutiveReport(bundle, "pdf");
    assert.equal(pdf.mime, "application/pdf");
    assert.ok(pdf.content.includes("MATRIX EXECUTIVE REPORT"));
  });
});
