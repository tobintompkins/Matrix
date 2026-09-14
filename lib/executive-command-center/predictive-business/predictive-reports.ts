/**
 * Patch 51C.2 — Predictive report sections for the 51C.1 report builder.
 * Internal/executive only — never expose customer service health scores to portal.
 */

import type { ExecutiveReportSection } from "../analytics-types";
import { getPredictiveBusinessAnalytics } from "./index";
import { isPredictiveBusinessAnalytics51c2Enabled } from "../feature-flag";

export async function buildPredictiveBusinessReportSections(): Promise<
  ExecutiveReportSection[]
> {
  if (!isPredictiveBusinessAnalytics51c2Enabled()) return [];

  const pba = await getPredictiveBusinessAnalytics({ horizon: "MONTH" });
  if (!pba.enabled) return [];

  return [
    {
      key: "predictiveBusiness",
      title: "Predictive business analytics",
      summary: [
        `Service demand forecast ${pba.serviceDemand.nextPeriodForecast ?? "n/a"} (${pba.serviceDemand.meta.methodLabel}, v${pba.serviceDemand.meta.methodVersion}).`,
        `PM jobs in horizon ${pba.pmWorkload.forecast.jobsInHorizon ?? "n/a"}.`,
        `Parts demand ${pba.partsDemand.nextPeriodForecast ?? "n/a"}; high stockout risks ${pba.partsDemand.stockoutRisk.filter((p) => p.risk === "HIGH").length}.`,
        `Tech capacity gap ${pba.technicianCapacity.forecast.gapHours ?? "n/a"}h.`,
        `Data quality sufficient: ${pba.dataQuality.overallSufficient ? "yes" : "no"}.`,
      ].join(" "),
      metrics: [
        {
          label: "Service forecast",
          value: String(pba.serviceDemand.nextPeriodForecast ?? "—"),
        },
        {
          label: "PM jobs",
          value: String(pba.pmWorkload.forecast.jobsInHorizon ?? "—"),
        },
        {
          label: "Parts forecast",
          value: String(pba.partsDemand.nextPeriodForecast ?? "—"),
        },
        {
          label: "Capacity gap (h)",
          value: String(pba.technicianCapacity.forecast.gapHours ?? "—"),
        },
      ],
      href: "/executive-command-center/predictive-analytics",
    },
  ];
}
