/**
 * Patch 51A.5 Part 3 Completion — Executive AI Insights Q&A (deterministic fallback).
 */

import { getExecutivePeriodReport } from "./reporting";
import { syncExecutiveAlerts, listExecutiveAlerts } from "./alerts";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";

export type ExecutiveInsightAnswer = {
  question: string;
  answer: string;
  observed: string[];
  interpretation: string[];
  sources: Array<{ label: string; href: string }>;
  isSample: boolean;
  provider: string;
  model: string;
  generatedAt: string;
};

const PRESETS: Array<{ id: string; label: string; match: RegExp }> = [
  {
    id: "attention-today",
    label: "What needs attention today?",
    match: /attention|today|priority/i,
  },
  {
    id: "machine-risk",
    label: "Which machines have the greatest operational risk?",
    match: /machine|operational risk|fleet/i,
  },
  {
    id: "customers",
    label: "Which customers are deteriorating?",
    match: /customer|deteriorat/i,
  },
  {
    id: "repeats",
    label: "Where are repeat failures increasing?",
    match: /repeat/i,
  },
  {
    id: "pm",
    label: "Which PMs are most urgent?",
    match: /\bpm\b|preventive/i,
  },
  {
    id: "inventory",
    label: "What inventory shortages could affect service?",
    match: /inventory|stock|parts shortage/i,
  },
  {
    id: "technicians",
    label: "Which technicians appear overloaded?",
    match: /technician|overload|workload/i,
  },
  {
    id: "changed",
    label: "What changed from the previous period?",
    match: /changed|previous|period|trend/i,
  },
];

export function listExecutiveInsightPresets() {
  return PRESETS.map(({ id, label }) => ({ id, label }));
}

export async function answerExecutiveInsight(input: {
  question: string;
  organizationId?: string;
}): Promise<ExecutiveInsightAnswer> {
  const organizationId = input.organizationId ?? DEFAULT_ORG_ID;
  const question = input.question.trim() || "What needs attention today?";
  const report = await getExecutivePeriodReport({
    organizationId,
    period: "DAILY",
    bypassCache: true,
  });
  await syncExecutiveAlerts(organizationId);
  const alerts = await listExecutiveAlerts({
    organizationId,
    status: "OPEN",
    pageSize: 10,
  });

  const observed: string[] = [
    ...report.highlights.slice(0, 6),
    ...report.scorecards
      .filter((s) => s.available)
      .slice(0, 6)
      .map((s) => `${s.label}: ${s.value} (${s.status})`),
    ...alerts.items.slice(0, 5).map((a) => `Alert: ${a.title}`),
  ];

  const interpretation: string[] = [];
  const sources: ExecutiveInsightAnswer["sources"] = [
    { label: "Report Center", href: "/executive-command-center/report-center" },
    { label: "Alerts & Actions", href: "/executive-command-center/alerts" },
  ];

  let answer = "";
  if (/customer|deteriorat/i.test(question)) {
    const widget = report.widgets.find((w) => w.key === "topCustomers");
    answer =
      widget && !widget.empty
        ? `Customers with the most open-call pressure: ${widget.rows
            .slice(0, 3)
            .map((r) => r.label)
            .join(", ")}.`
        : "No customer open-call pressure detected in the current period.";
    sources.push({
      label: "Customer analytics",
      href: "/executive-command-center/customers",
    });
    interpretation.push(
      "Customer deterioration is inferred from open/critical call pressure, not CRM sentiment scores.",
    );
  } else if (/repeat/i.test(question)) {
    const widget = report.widgets.find((w) => w.key === "repeatCalls");
    answer =
      widget && !widget.empty
        ? `Repeat service patterns: ${widget.rows
            .slice(0, 3)
            .map((r) => `${r.label} (${r.value})`)
            .join("; ")}.`
        : "No repeat-failure pattern (≥3 calls / 90d) in scope.";
    interpretation.push(
      "Repeat failures use a 90-day revisit count proxy from service-call history.",
    );
  } else if (/\bpm\b|preventive/i.test(question)) {
    const pm = report.scorecards.find((s) => s.key === "pmCompliance");
    answer =
      pm?.available
        ? `PM compliance is ${pm.value}% — ${pm.detail}.`
        : "PM compliance is unavailable (no PM states loaded).";
    sources.push({ label: "Maintenance", href: "/maintenance" });
  } else if (/inventory|stock|parts/i.test(question)) {
    const inv = report.scorecards.find((s) => s.key === "inventoryAccuracy");
    const forecast = report.widgets.find((w) => w.key === "inventoryForecast");
    answer = [
      inv?.available
        ? `Inventory accuracy proxy: ${inv.value}.`
        : "Inventory accuracy unavailable.",
      forecast && !forecast.empty
        ? `Reorder pressure examples: ${forecast.rows
            .slice(0, 3)
            .map((r) => r.label)
            .join(", ")}.`
        : "No reorder-point breaches listed.",
    ].join(" ");
    sources.push({ label: "Inventory", href: "/inventory" });
  } else if (/technician|overload|workload/i.test(question)) {
    const tech = report.scorecards.find((s) => s.key === "techProductivity");
    answer =
      tech?.available
        ? `Technician productivity proxy is ${tech.value}% — ${tech.detail}.`
        : "Technician productivity unavailable (empty roster).";
    sources.push({
      label: "Technician analytics",
      href: "/executive-command-center/technicians",
    });
  } else if (/changed|previous|period|trend/i.test(question)) {
    answer =
      report.comparisons.length === 0
        ? "No period comparisons available."
        : report.comparisons
            .slice(0, 4)
            .map(
              (c) =>
                `${c.metric}: ${c.previous} → ${c.current} (${c.direction}, Δ ${c.delta})`,
            )
            .join("; ");
    sources.push({
      label: "Comparisons",
      href: "/executive-command-center/comparisons",
    });
  } else if (/machine|operational risk|fleet/i.test(question)) {
    const cost = report.widgets.find((w) => w.key === "highestCostMachines");
    const fleet = report.scorecards.find((s) => s.key === "fleetHealth");
    answer = [
      fleet?.available
        ? `Fleet health score ${fleet.value} (${fleet.status}).`
        : "Fleet health unavailable.",
      cost && !cost.empty
        ? `Highest cost/activity machines: ${cost.rows
            .slice(0, 3)
            .map((r) => r.label)
            .join(", ")}.`
        : "",
    ]
      .filter(Boolean)
      .join(" ");
    sources.push({
      label: "Predictive",
      href: "/executive-command-center/predictive",
    });
  } else {
    const topAlerts = alerts.items.slice(0, 3).map((a) => a.title);
    answer =
      topAlerts.length > 0
        ? `Top attention items: ${topAlerts.join("; ")}.`
        : report.aiSummary.summary;
    interpretation.push(
      "Attention ranking uses the Executive Action Center inbox plus daily report highlights.",
    );
  }

  if (interpretation.length === 0) {
    interpretation.push(
      "This answer is a deterministic Matrix summary. Observed facts are listed separately from interpretation.",
    );
  }

  return {
    question,
    answer,
    observed,
    interpretation,
    sources,
    isSample: true,
    provider: "matrix-local",
    model: "executive-insights-qa-v1",
    generatedAt: new Date().toISOString(),
  };
}
