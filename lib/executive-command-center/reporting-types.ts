/**
 * Patch 51A.5 Part 3 — Client-safe reporting types.
 */

export type ExecutiveReportPeriod =
  | "DAILY"
  | "WEEKLY"
  | "MONTHLY"
  | "QUARTERLY"
  | "ANNUAL";

export type ExecutiveExportFormat = "csv" | "excel" | "pdf";

export type ComparisonMode =
  | "WEEK_VS_PREV"
  | "MONTH_VS_PREV"
  | "QUARTER_VS_PREV"
  | "YEAR_VS_PREV";

export type KpiScorecardItem = {
  key: string;
  label: string;
  value: number | null;
  previousValue?: number | null;
  absoluteChange?: number | null;
  percentChange?: number | null;
  trend?: "up" | "down" | "flat" | "unavailable";
  unit: "score" | "percent" | "hours" | "count" | "ratio";
  status: "excellent" | "good" | "watch" | "critical" | "unavailable";
  detail: string;
  definition?: string;
  href?: string;
  available: boolean;
  updatedAt?: string;
};

export type TrendComparisonRow = {
  metric: string;
  current: number;
  previous: number;
  delta: number;
  deltaPercent: number | null;
  direction: "up" | "down" | "flat";
};

export type DashboardWidgetRow = {
  id: string;
  label: string;
  value: string;
  secondary?: string;
  href?: string;
};

export type DashboardWidget = {
  key: string;
  title: string;
  empty: boolean;
  emptyMessage?: string;
  rows: DashboardWidgetRow[];
  page: number;
  pageSize: number;
  total: number;
};

export type AiExecutiveReportSummary = {
  summary: string;
  sections: Array<{
    title: string;
    body: string;
    kind: "fact" | "recommendation";
  }>;
  generatedAt: string;
  isSample: boolean;
  provider: string;
  model: string;
  confidence: number;
};

export type PeriodReportBundle = {
  period: ExecutiveReportPeriod;
  periodLabel: string;
  generatedAt: string;
  window: { start: string; end: string };
  previousWindow: { start: string; end: string };
  scorecards: KpiScorecardItem[];
  comparisons: TrendComparisonRow[];
  widgets: DashboardWidget[];
  aiSummary: AiExecutiveReportSummary;
  highlights: string[];
  cacheHit: boolean;
};
