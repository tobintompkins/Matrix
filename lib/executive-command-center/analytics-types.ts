/**
 * Patch 51A.5 Part 2 — Client-safe analytics types (no Prisma / server imports).
 */

import type { ExecutiveAnalyticsRange } from "./date-range";

export type TrendPoint = {
  date: string;
  openCalls: number;
  criticalCalls: number;
  closedCalls: number;
  insightsCreated: number;
  insightsCritical: number;
};

export type TechnicianMetricRow = {
  name: string;
  status: string;
  openCalls: number;
  criticalCalls: number;
  workloadHours: number;
  territory: string;
  href: string;
};

export type CustomerHealthRow = {
  customerId: string;
  name: string;
  openCalls: number;
  criticalCalls: number;
  machinesAtRisk: number;
  riskLabel: "Healthy" | "Watch" | "At Risk" | "Critical";
  href: string;
};

export type PredictiveAnalytics = {
  machinesEvaluated: number;
  highRisk: number;
  criticalRisk: number;
  openAlerts: number;
  dueSoon14d: number;
  topRiskMachines: Array<{
    machineId: string;
    riskLevel: string;
    healthScore: number;
    reason: string | null;
    href: string;
  }>;
};

export type AiInsightSummary = {
  active: number;
  critical: number;
  pendingReview: number;
  trendEmpty: boolean;
  series: Array<{
    date: string;
    created: number;
    critical: number;
    resolved: number;
  }>;
  topInsights: Array<{
    id: string;
    title: string;
    severity: string;
    status: string;
    href: string;
  }>;
};

export type ExecutiveReportSection = {
  key: string;
  title: string;
  summary: string;
  metrics: Array<{ label: string; value: string }>;
  href: string;
};

export type ExecutiveAnalyticsPayload = {
  generatedAt: string;
  range: ExecutiveAnalyticsRange;
  rangeLabel: string;
  days: number;
  dataCompleteness: number;
  empty: boolean;
  emptyMessage: string | null;
  kpiTrends: {
    current: {
      openServiceCalls: number;
      criticalServiceCalls: number;
      pmOverdue: number;
      machinesAtRisk: number;
      activeTechnicians: number;
      fleetHealthScore: number | null;
      openDecisions: number;
    };
    series: TrendPoint[];
    seriesEmpty: boolean;
  };
  technicians: TechnicianMetricRow[];
  customers: CustomerHealthRow[];
  predictive: PredictiveAnalytics;
  aiInsights: AiInsightSummary;
  reports: ExecutiveReportSection[];
  drilldowns: Array<{ key: string; label: string; href: string; count: number }>;
};
