/**
 * Patch 51C.3 — Executive AI Copilot answers grounded only in Matrix data.
 * Never fabricates metrics. Reuses period report, alerts, PBA, decision support.
 */

import { getExecutivePeriodReport } from "../reporting";
import { syncExecutiveAlerts, listExecutiveAlerts } from "../alerts";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import { getAiAssistantProvider } from "@/lib/matrix-assist/provider";
import { getExecutiveDecisionSupport } from "./decision-support";
import type {
  CopilotRelatedReport,
  CopilotSupportingRecord,
  ExecutiveCopilotAnswer,
} from "./types";

export const COPILOT_PRESETS: Array<{ id: string; label: string; match: RegExp }> = [
  {
    id: "customer-risk",
    label: "What customers are at highest operational risk?",
    match: /customers? .* (highest|operational)?\s*risk|highest operational risk/i,
  },
  {
    id: "cost-machines",
    label: "What machines are costing us the most money?",
    match: /costing|highest cost|most money|cost drivers?/i,
  },
  {
    id: "pm-compliance",
    label: "Show PM compliance this month.",
    match: /pm compliance|preventive.*month/i,
  },
  {
    id: "ftf-techs",
    label: "Which technicians have the highest first-time fix rate?",
    match: /first[- ]?time fix|ftf|technician.*fix/i,
  },
  {
    id: "reorder-parts",
    label: "What parts should we reorder?",
    match: /parts? should we reorder|reorder|stockout|parts demand/i,
  },
  {
    id: "fail-next-month",
    label: "What machines will likely fail next month?",
    match: /likely fail|fail next|predictive|will fail/i,
  },
  {
    id: "feeder-problems",
    label: "What customers have recurring feeder problems?",
    match: /feeder|recurring .*problem|repeat.*problem/i,
  },
  {
    id: "cost-drivers",
    label: "What are the biggest cost drivers?",
    match: /biggest cost|cost driver/i,
  },
  {
    id: "locations",
    label: "What locations need attention?",
    match: /locations? need|sites? need|which (site|location)/i,
  },
  {
    id: "attention-today",
    label: "What needs attention today?",
    match: /attention|today|priority/i,
  },
  {
    id: "forecasts",
    label: "What do business forecasts show?",
    match: /forecast|demand|capacity|scenario|predictive business/i,
  },
];

export function listCopilotPresets() {
  return COPILOT_PRESETS.map(({ id, label }) => ({ id, label }));
}

function confidenceFromEvidence(input: {
  observedCount: number;
  records: number;
  dataSufficient?: boolean;
}): number {
  let c = 35;
  c += Math.min(35, input.observedCount * 4);
  c += Math.min(20, input.records * 5);
  if (input.dataSufficient === false) c = Math.min(c, 45);
  return Math.max(15, Math.min(92, Math.round(c)));
}

export async function answerExecutiveCopilot(input: {
  question: string;
  organizationId?: string;
}): Promise<ExecutiveCopilotAnswer> {
  const organizationId = input.organizationId ?? DEFAULT_ORG_ID;
  const question = input.question.trim() || "What needs attention today?";

  const [report, , alerts, decisions] = await Promise.all([
    getExecutivePeriodReport({
      organizationId,
      period: "DAILY",
      bypassCache: true,
    }),
    syncExecutiveAlerts(organizationId),
    listExecutiveAlerts({
      organizationId,
      status: "OPEN",
      pageSize: 10,
    }),
    getExecutiveDecisionSupport({ organizationId }),
  ]);

  const observed: string[] = [
    ...report.highlights.slice(0, 6),
    ...report.scorecards
      .filter((s) => s.available)
      .slice(0, 6)
      .map((s) => `${s.label}: ${s.value} (${s.status})`),
    ...alerts.items.slice(0, 5).map((a) => `Alert: ${a.title}`),
  ];

  const supportingRecords: CopilotSupportingRecord[] = [];
  const relatedReports: CopilotRelatedReport[] = [
    {
      label: "Report Center",
      href: "/executive-command-center/report-center",
      sectionKey: "ai",
    },
    {
      label: "Alerts & Actions",
      href: "/executive-command-center/alerts",
    },
  ];
  const assumptions: string[] = [
    "Answers use only Matrix ECC period report, alerts, inventory, PM, and predictive modules.",
    "Copilot never fabricates missing metrics — unavailable data is stated explicitly.",
  ];
  const interpretation: string[] = [];
  const sources: Array<{ label: string; href: string }> = [
    ...relatedReports.map((r) => ({ label: r.label, href: r.href })),
  ];

  let answer = "";
  let dataSufficient = true;

  const q = question;

  if (
    /customers? .*risk|highest operational risk|deteriorat|customer health/i.test(q)
  ) {
    const widget = report.widgets.find((w) => w.key === "topCustomers");
    if (widget && !widget.empty) {
      answer = `Customers with the highest open-call / operational pressure: ${widget.rows
        .slice(0, 5)
        .map((r) => r.label)
        .join(", ")}.`;
      for (const r of widget.rows.slice(0, 5)) {
        supportingRecords.push({
          id: r.id,
          type: "customer",
          label: r.label,
          href: r.href,
          detail: `${r.value}${r.secondary ? ` · ${r.secondary}` : ""}`,
        });
      }
    } else {
      answer =
        "No customer operational-risk pressure detected in the current period (insufficient open-call signal).";
      dataSufficient = false;
    }
    relatedReports.push({
      label: "Customer Reliability",
      href: "/executive-command-center/customers",
      sectionKey: "customers",
    });
    sources.push({
      label: "Customer Reliability",
      href: "/executive-command-center/customers",
    });
    assumptions.push(
      "Operational risk here is inferred from open/critical call pressure — internal executive score, not portal-visible.",
    );
    interpretation.push(
      "Escalate only after confirming live service-call and customer records.",
    );
  } else if (/costing|highest cost|most money|cost driver/i.test(q)) {
    const cost = report.widgets.find((w) => w.key === "highestCostMachines");
    const parts = report.widgets.find((w) => w.key === "partsConsumption");
    if (cost && !cost.empty) {
      answer = `Biggest machine cost/activity drivers: ${cost.rows
        .slice(0, 5)
        .map((r) => `${r.label} (${r.value})`)
        .join("; ")}.`;
      for (const r of cost.rows.slice(0, 5)) {
        supportingRecords.push({
          id: r.id,
          type: "machine",
          label: r.label,
          href: r.href,
          detail: r.value,
        });
      }
    } else {
      answer = "No machine cost/activity ranking available for this period.";
      dataSufficient = false;
    }
    if (parts && !parts.empty) {
      answer += ` Top parts consumption: ${parts.rows
        .slice(0, 3)
        .map((r) => r.label)
        .join(", ")}.`;
    }
    relatedReports.push({
      label: "Dashboard Widgets",
      href: "/executive-command-center/widgets",
    });
    sources.push({
      label: "Cost widgets",
      href: "/executive-command-center/widgets",
    });
    assumptions.push(
      "Cost ranking is an activity/parts proxy from service history — not a full GL revenue ledger.",
    );
  } else if (/\bpm\b|preventive|pm compliance/i.test(q)) {
    const pm = report.scorecards.find((s) => s.key === "pmCompliance");
    const pmWidget = report.widgets.find((w) => w.key === "pmCompletion");
    answer = pm?.available
      ? `PM compliance is ${pm.value}% — ${pm.detail}.`
      : "PM compliance is unavailable (no PM states loaded).";
    if (!pm?.available) dataSufficient = false;
    if (pmWidget && !pmWidget.empty) {
      for (const r of pmWidget.rows.filter((x) => /overdue/i.test(x.value)).slice(0, 5)) {
        supportingRecords.push({
          id: r.id,
          type: "pm_state",
          label: r.label,
          href: r.href ?? "/maintenance",
          detail: r.value,
        });
      }
    }
    relatedReports.push({
      label: "Maintenance",
      href: "/maintenance",
      sectionKey: "pm",
    });
    sources.push({ label: "Maintenance", href: "/maintenance" });
    assumptions.push("PM compliance uses MachinePmState meter due logic.");
  } else if (/first[- ]?time fix|ftf|technician.*fix|technician.*highest/i.test(q)) {
    const tech = report.scorecards.find((s) => s.key === "techProductivity");
    answer = tech?.available
      ? `Technician productivity / first-time-fix proxy is ${tech.value}% — ${tech.detail}. Drill into Technician Performance for per-tech detail.`
      : "Technician first-time-fix ranking is unavailable (empty roster or insufficient closed calls).";
    if (!tech?.available) dataSufficient = false;
    relatedReports.push({
      label: "Technician Performance",
      href: "/executive-command-center/technicians",
      sectionKey: "technicianProductivity",
    });
    sources.push({
      label: "Technician analytics",
      href: "/executive-command-center/technicians",
    });
    assumptions.push(
      "First-time fix is a closed-call proxy from service history, not a certified OEM FTF metric.",
    );
  } else if (/reorder|stockout|parts should|inventory shortage|parts demand/i.test(q)) {
    const forecast = report.widgets.find((w) => w.key === "inventoryForecast");
    const inv = report.scorecards.find((s) => s.key === "inventoryAccuracy");
    answer = [
      inv?.available ? `Inventory accuracy proxy: ${inv.value}.` : null,
      forecast && !forecast.empty
        ? `Parts to review for reorder: ${forecast.rows
            .slice(0, 5)
            .map((r) => r.label)
            .join(", ")}.`
        : "No reorder-point breaches listed in the current report window.",
    ]
      .filter(Boolean)
      .join(" ");
    if (!forecast || forecast.empty) dataSufficient = false;
    if (forecast) {
      for (const r of forecast.rows.slice(0, 5)) {
        supportingRecords.push({
          id: r.id,
          type: "part",
          label: r.label,
          href: r.href ?? "/inventory",
          detail: r.value,
        });
      }
    }
    relatedReports.push(
      { label: "Inventory", href: "/inventory" },
      {
        label: "Business Forecasts",
        href: "/executive-command-center/predictive-analytics",
        sectionKey: "predictiveBusiness",
      },
    );
    sources.push({ label: "Inventory", href: "/inventory" });
    assumptions.push(
      "Reorder suggestions never create purchase orders — confirm in Parts Center.",
    );
    interpretation.push(
      ...decisions.recommendations
        .filter((r) => r.action === "order_inventory")
        .map((r) => `Recommendation: ${r.title}`),
    );
  } else if (/likely fail|fail next|will fail|machines? .*risk|fleet/i.test(q)) {
    const cost = report.widgets.find((w) => w.key === "highestCostMachines");
    const fleet = report.scorecards.find((s) => s.key === "fleetHealth");
    const repeats = report.widgets.find((w) => w.key === "repeatCalls");
    answer = [
      fleet?.available
        ? `Fleet health score ${fleet.value} (${fleet.status}).`
        : "Fleet health unavailable.",
      repeats && !repeats.empty
        ? `Repeat / elevated risk machines: ${repeats.rows
            .slice(0, 5)
            .map((r) => r.label)
            .join(", ")}.`
        : "No repeat-failure machines (≥3 calls / 90d) in scope.",
    ].join(" ");
    if (repeats) {
      for (const r of repeats.rows.slice(0, 5)) {
        supportingRecords.push({
          id: r.id,
          type: "machine",
          label: r.label,
          href:
            r.href ??
            `/ai-operations/predictive-maintenance/machines/${encodeURIComponent(r.id)}`,
          detail: r.value,
        });
      }
    }
    relatedReports.push({
      label: "Predictive Trends",
      href: "/executive-command-center/predictive",
      sectionKey: "predictive",
    });
    sources.push({
      label: "Predictive",
      href: "/executive-command-center/predictive",
    });
    assumptions.push(
      "Failure likelihood is inferred from predictive risk + repeat service patterns — not a guaranteed failure date.",
    );
    void cost;
  } else if (/feeder|recurring .*problem|repeat/i.test(q)) {
    const repeats = report.widgets.find((w) => w.key === "repeatCalls");
    const customers = report.widgets.find((w) => w.key === "topCustomers");
    if (repeats && !repeats.empty) {
      answer = /feeder/i.test(q)
        ? `Recurring problem patterns (including feeder-related when tagged in call text) concentrate on: ${repeats.rows
            .slice(0, 5)
            .map((r) => `${r.label} (${r.value})`)
            .join("; ")}. Problem-code detail requires opening the linked service records.`
        : `Repeat service patterns: ${repeats.rows
            .slice(0, 5)
            .map((r) => `${r.label} (${r.value})`)
            .join("; ")}.`;
      for (const r of repeats.rows.slice(0, 5)) {
        supportingRecords.push({
          id: r.id,
          type: "machine",
          label: r.label,
          href: r.href,
          detail: r.value,
        });
      }
    } else {
      answer =
        "No repeat-failure pattern (≥3 calls / 90d) found. Feeder-specific filters need problem-code tags on service calls.";
      dataSufficient = false;
    }
    if (customers && !customers.empty && /customer/i.test(q)) {
      answer += ` Customers with pressure: ${customers.rows
        .slice(0, 3)
        .map((r) => r.label)
        .join(", ")}.`;
    }
    assumptions.push(
      "Feeder problems are surfaced via repeat-call proxies unless problem codes are present on tickets.",
    );
    interpretation.push(
      "Open linked service calls to confirm feeder symptom text before acting.",
    );
  } else if (/location|site/i.test(q)) {
    const aging = report.widgets.find((w) => w.key === "agingCalls");
    if (aging && !aging.empty) {
      answer = `Locations/sites needing attention (from aging open calls): ${aging.rows
        .slice(0, 5)
        .map((r) => `${r.label}${r.secondary ? ` @ ${r.secondary}` : ""}`)
        .join("; ")}.`;
      for (const r of aging.rows.slice(0, 5)) {
        supportingRecords.push({
          id: r.id,
          type: "service_call",
          label: r.label,
          href: r.href,
          detail: r.secondary,
        });
      }
    } else {
      answer =
        "No aging open calls to rank locations. Site attention is otherwise inferred from customer open-call pressure.";
      dataSufficient = false;
    }
    sources.push({
      label: "Service calls",
      href: "/service-calls?status=OPEN",
    });
  } else if (/forecast|demand|capacity|scenario|predictive business/i.test(q)) {
    try {
      const { getPredictiveBusinessAnalytics } = await import("../predictive-business");
      const pba = await getPredictiveBusinessAnalytics({
        organizationId,
        horizon: "MONTH",
      });
      if (!pba.enabled) {
        answer = pba.message;
        dataSufficient = false;
      } else {
        answer = [
          `Service demand forecast: ${pba.serviceDemand.nextPeriodForecast ?? "insufficient data"} (${pba.serviceDemand.meta.methodLabel}).`,
          `PM jobs in horizon: ${pba.pmWorkload.forecast.jobsInHorizon ?? "n/a"}.`,
          `Parts demand forecast: ${pba.partsDemand.nextPeriodForecast ?? "n/a"}; high stockout risks: ${pba.partsDemand.stockoutRisk.filter((p) => p.risk === "HIGH").length}.`,
          `Tech capacity gap hours: ${pba.technicianCapacity.forecast.gapHours ?? "n/a"}.`,
        ].join(" ");
        observed.push(
          ...pba.dataQuality.sources.map(
            (s) => `${s.source}: ${s.recordCount} records`,
          ),
        );
        assumptions.push(...pba.serviceDemand.meta.assumptions.slice(0, 2));
        dataSufficient = pba.dataQuality.overallSufficient;
      }
    } catch {
      answer = "Predictive business analytics could not be loaded.";
      dataSufficient = false;
    }
    relatedReports.push({
      label: "Business Forecasts",
      href: "/executive-command-center/predictive-analytics",
      sectionKey: "predictiveBusiness",
    });
    sources.push({
      label: "Business Forecasts",
      href: "/executive-command-center/predictive-analytics",
    });
  } else {
    const topAlerts = alerts.items.slice(0, 3);
    answer =
      topAlerts.length > 0
        ? `Top attention items: ${topAlerts.map((a) => a.title).join("; ")}.`
        : report.aiSummary.summary;
    for (const a of topAlerts) {
      supportingRecords.push({
        id: a.id,
        type: "executive_alert",
        label: a.title,
        href: a.href ?? "/executive-command-center/alerts",
        detail: a.explanation,
      });
    }
    interpretation.push(
      "Attention ranking uses the Executive Action Center inbox plus daily report highlights.",
    );
  }

  if (interpretation.length === 0) {
    interpretation.push(
      "Observed facts are Matrix records; interpretation is advisory decision support only.",
    );
  }

  // Attach top non-executing recommendations when relevant
  const recs = decisions.recommendations.slice(0, 4);
  interpretation.push(
    ...recs.map((r) => `Decision support (${r.action}): ${r.title} — not auto-executed.`),
  );

  let isSample = true;
  let providerName = "matrix-local";
  let model = "executive-ai-copilot-v1";

  try {
    const provider = getAiAssistantProvider();
    if (provider) {
      const draft = await provider.draftServiceNotes({
        customerComplaint: `Executive AI Copilot question: ${question}`,
        inspection:
          observed.slice(0, 8).join(" | ") || "No observed KPI facts yet.",
        finalResult: answer,
        followUp: [...assumptions.slice(0, 2), ...interpretation.slice(0, 2)].join(
          " ",
        ),
        machineStatus: "Executive Copilot — review before acting. Never fabricate.",
      });
      if (draft.fullText?.trim()) {
        interpretation.push(
          `Matrix Assist packaging (${provider.name}): ${draft.fullText.trim().slice(0, 360)}`,
        );
      }
      isSample = provider.isSample;
      providerName = `matrix-assist:${provider.name}`;
      model = provider.isSample
        ? "assist-sample-executive-copilot-v1"
        : "assist-provider-executive-copilot-v1";
      sources.push({
        label: "Matrix Assist",
        href: "/ai-operations/assistant",
      });
    }
  } catch {
    interpretation.push(
      "Matrix Assist was unavailable; deterministic executive Copilot answer returned.",
    );
  }

  const confidence = confidenceFromEvidence({
    observedCount: observed.length,
    records: supportingRecords.length,
    dataSufficient,
  });

  return {
    question,
    answer,
    confidence,
    supportingRecords,
    relatedReports,
    assumptions,
    observed,
    interpretation,
    sources,
    recommendations: recs,
    isSample,
    provider: providerName,
    model,
    generatedAt: new Date().toISOString(),
    fabricated: false,
  };
}
