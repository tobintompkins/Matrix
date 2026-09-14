/**
 * Patch 51C.3 — Executive AI Copilot types.
 * Extends ECC AI Ask — not a new assistant product.
 */

export type CopilotSupportingRecord = {
  id: string;
  type: string;
  label: string;
  href?: string;
  detail?: string;
};

export type CopilotRelatedReport = {
  label: string;
  href: string;
  sectionKey?: string;
};

export type CopilotDecisionRecommendation = {
  id: string;
  action:
    | "increase_pm"
    | "order_inventory"
    | "schedule_technician"
    | "escalate_customer"
    | "watch_failing_machines"
    | "training_opportunity"
    | "inventory_optimization";
  title: string;
  rationale: string;
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  href?: string;
  /** Always false — Copilot never executes. */
  executable: false;
  requiresUserConfirmation: true;
};

export type ExecutiveCopilotAnswer = {
  question: string;
  answer: string;
  confidence: number;
  supportingRecords: CopilotSupportingRecord[];
  relatedReports: CopilotRelatedReport[];
  assumptions: string[];
  observed: string[];
  interpretation: string[];
  sources: Array<{ label: string; href: string }>;
  recommendations: CopilotDecisionRecommendation[];
  isSample: boolean;
  provider: string;
  model: string;
  generatedAt: string;
  fabricated: false;
};

export type ExecutiveDashboardWidgetDef = {
  key: string;
  title: string;
  description: string;
  href: string;
  source: "overview" | "reporting" | "analytics" | "predictive" | "briefings" | "alerts";
};

export type DailyExecutiveBriefing = {
  generatedAt: string;
  todaysPriorities: string[];
  machineDownSummary: string;
  criticalCustomers: string[];
  pmCompliance: string;
  inventoryShortages: string;
  upcomingPmWorkload: string;
  openServiceCalls: string;
  highCostRepairs: string[];
  recommendedActions: CopilotDecisionRecommendation[];
  confidence: number;
  assumptions: string[];
};

export type WeeklyExecutiveReportSummary = {
  generatedAt: string;
  periodLabel: string;
  serviceMetrics: string[];
  pmMetrics: string[];
  inventoryMetrics: string[];
  customerTrends: string[];
  aiRecommendations: string[];
  operationalRisks: string[];
  confidence: number;
  assumptions: string[];
  href: string;
};
