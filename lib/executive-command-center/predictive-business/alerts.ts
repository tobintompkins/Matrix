/**
 * Patch 51C.2 — Predictive business alert candidates for Executive Action Center.
 */

import { getPartsDemandForecast } from "./parts-demand";
import { getTechnicianCapacityForecast } from "./technician-capacity";
import { getServiceDemandForecast } from "./service-demand";
import { getPmWorkloadForecast } from "./pm-workload";
import { isPredictiveBusinessAnalytics51c2Enabled } from "../feature-flag";

export type PredictiveBusinessAlertCandidate = {
  alertKey: string;
  category: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  title: string;
  explanation: string;
  href?: string;
  recommendedAction?: string;
  sourceType: string;
  sourceRecordId?: string;
};

export async function collectPredictiveBusinessAlertCandidates(): Promise<
  PredictiveBusinessAlertCandidate[]
> {
  if (!isPredictiveBusinessAnalytics51c2Enabled()) return [];

  const out: PredictiveBusinessAlertCandidate[] = [];
  const [parts, tech, service, pm] = await Promise.all([
    Promise.resolve(getPartsDemandForecast({ horizon: "MONTH" })),
    Promise.resolve(getTechnicianCapacityForecast({ horizon: "MONTH" })),
    Promise.resolve(getServiceDemandForecast({ horizon: "MONTH" })),
    getPmWorkloadForecast({ horizon: "MONTH" }),
  ]);

  const highStockout = parts.stockoutRisk.filter((p) => p.risk === "HIGH").length;
  if (highStockout > 0) {
    out.push({
      alertKey: "pba:parts-stockout-risk",
      category: "parts-forecast",
      severity: highStockout >= 5 ? "CRITICAL" : "HIGH",
      title: "Parts stockout risk (forecast)",
      explanation: `${highStockout} part(s) show HIGH stockout risk from consumption vs on-hand.`,
      href: "/executive-command-center/predictive-analytics",
      recommendedAction:
        "Review Parts Center — do not auto-order; confirm demand before purchasing.",
      sourceType: "PredictiveBusinessAnalytics",
      sourceRecordId: "parts-stockout-risk",
    });
  }

  if (
    tech.forecast.gapHours != null &&
    tech.forecast.gapHours > 8 &&
    tech.meta.method !== "insufficient_data"
  ) {
    out.push({
      alertKey: "pba:tech-capacity-gap",
      category: "capacity-forecast",
      severity: tech.forecast.gapHours > 40 ? "HIGH" : "MEDIUM",
      title: "Technician capacity gap (forecast)",
      explanation: `Forecast demand exceeds capacity by ~${tech.forecast.gapHours} hours.`,
      href: "/executive-command-center/predictive-analytics",
      recommendedAction:
        "Review assignments manually — scenarios never auto-assign technicians.",
      sourceType: "PredictiveBusinessAnalytics",
      sourceRecordId: "tech-capacity-gap",
    });
  }

  if (
    service.nextPeriodForecast != null &&
    service.actualInHorizonWindow > 0 &&
    service.nextPeriodForecast >= service.actualInHorizonWindow * 1.4
  ) {
    out.push({
      alertKey: "pba:service-demand-surge",
      category: "service-forecast",
      severity: "MEDIUM",
      title: "Service demand surge signal",
      explanation: `Baseline forecast (${service.nextPeriodForecast}) is ≥40% above recent-horizon actuals (${service.actualInHorizonWindow}).`,
      href: "/executive-command-center/predictive-analytics",
      recommendedAction: "Validate with Service Hub volume before staffing changes.",
      sourceType: "PredictiveBusinessAnalytics",
      sourceRecordId: "service-demand-surge",
    });
  }

  if ((pm.forecast.jobsInHorizon ?? 0) >= 10) {
    out.push({
      alertKey: "pba:pm-workload-heavy",
      category: "pm-forecast",
      severity: "MEDIUM",
      title: "Elevated PM workload ahead",
      explanation: `${pm.forecast.jobsInHorizon} PM jobs overdue or due-soon by meter in horizon.`,
      href: "/executive-command-center/predictive-analytics",
      recommendedAction:
        "Plan PM manually in Maintenance — forecasts do not change schedules.",
      sourceType: "PredictiveBusinessAnalytics",
      sourceRecordId: "pm-workload-heavy",
    });
  }

  return out;
}
