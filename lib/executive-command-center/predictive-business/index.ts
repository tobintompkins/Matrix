/**
 * Patch 51C.2 — Orchestrates Predictive Business Analytics payload.
 */

import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import type { ForecastHorizon } from "./types";
import { getServiceDemandForecast } from "./service-demand";
import { getPmWorkloadForecast } from "./pm-workload";
import { getPartsDemandForecast } from "./parts-demand";
import { getMachineReliabilityTrends } from "./machine-reliability";
import { getCustomerOperationalRisk } from "./customer-operational-risk";
import { getTechnicianCapacityForecast } from "./technician-capacity";
import { getForecastAccuracyDashboard } from "./forecast-accuracy";
import { getPredictiveBusinessDataQuality } from "./data-quality";
import { isPredictiveBusinessAnalytics51c2Enabled } from "../feature-flag";

export async function getPredictiveBusinessAnalytics(input?: {
  organizationId?: string;
  horizon?: ForecastHorizon | string | null;
}) {
  const organizationId = input?.organizationId ?? DEFAULT_ORG_ID;
  const raw = (input?.horizon ?? "MONTH").toString().toUpperCase();
  const horizon: ForecastHorizon =
    raw === "WEEK" || raw === "QUARTER" || raw === "MONTH" ? raw : "MONTH";

  if (!isPredictiveBusinessAnalytics51c2Enabled()) {
    return {
      enabled: false as const,
      message:
        "Predictive Business Analytics is disabled (PREDICTIVE_BUSINESS_ANALYTICS_51C2).",
      generatedAt: new Date().toISOString(),
    };
  }

  const [
    serviceDemand,
    pmWorkload,
    partsDemand,
    machineReliability,
    customerRisk,
    technicianCapacity,
    accuracy,
    dataQuality,
  ] = await Promise.all([
    Promise.resolve(getServiceDemandForecast({ horizon })),
    getPmWorkloadForecast({ horizon, organizationId }),
    Promise.resolve(getPartsDemandForecast({ horizon })),
    getMachineReliabilityTrends({ organizationId }),
    getCustomerOperationalRisk({ organizationId }),
    Promise.resolve(getTechnicianCapacityForecast({ horizon })),
    Promise.resolve(getForecastAccuracyDashboard()),
    getPredictiveBusinessDataQuality({ organizationId }),
  ]);

  return {
    enabled: true as const,
    generatedAt: new Date().toISOString(),
    horizon,
    serviceDemand,
    pmWorkload,
    partsDemand,
    machineReliability,
    customerRisk,
    technicianCapacity,
    accuracy,
    dataQuality,
    safety: {
      actualsSeparatedFromForecasts: true,
      scenariosMutateLiveRecords: false,
      autoOrderParts: false,
      autoChangePmSchedules: false,
      autoAssignTechnicians: false,
    },
  };
}

export type PredictiveBusinessAnalyticsPayload = Awaited<
  ReturnType<typeof getPredictiveBusinessAnalytics>
>;
