/**
 * Patch 51A.5 Part 1 — Executive Command Center types.
 */

export type FleetHealthStatus =
  | "excellent"
  | "good"
  | "watch"
  | "critical"
  | "unknown";

export type FleetHealthFactor = {
  key: string;
  label: string;
  value: number | null;
  impact: "positive" | "neutral" | "negative";
  note?: string;
};

export type ExecutivePrioritySeverity =
  | "CRITICAL"
  | "HIGH"
  | "MEDIUM"
  | "LOW"
  | "INFO";

export type ExecutivePrioritySource =
  | "Service"
  | "Predictive Maintenance"
  | "Preventive Maintenance"
  | "Decision Engine"
  | "Automation"
  | "AI Operations";

export type ExecutivePriorityItem = {
  id: string;
  severity: ExecutivePrioritySeverity;
  title: string;
  reason: string;
  recommendedNextStep: string;
  href: string;
  source: ExecutivePrioritySource;
  customerName?: string | null;
  siteName?: string | null;
  machineId?: string | null;
  createdAt?: string | null;
  sortKey: number;
};

export type ExecutiveBriefingPriority = {
  title: string;
  reason: string;
  href?: string | null;
  kind: "fact" | "recommendation";
};

export type ExecutiveBriefing = {
  summary: string;
  priorities: ExecutiveBriefingPriority[];
  generatedAt: string;
  provider: string;
  model: string;
  isSample: boolean;
  insufficientData: boolean;
  confidence: number;
};

export type ExecutiveKpis = {
  activeMachines: number;
  openServiceCalls: number;
  criticalServiceCalls: number;
  machinesAtRisk: number;
  pmDue: number;
  pmOverdue: number;
  criticalAlerts: number;
  activeTechnicians: number;
  technicianCoverageLabel: string;
};

export type EnterpriseStatusPanel = {
  key: string;
  title: string;
  status: "ok" | "watch" | "attention" | "unknown";
  headline: string;
  items: Array<{ label: string; value: string; href?: string }>;
  href: string;
};

export type ExecutiveCommandCenterSummary = {
  generatedAt: string;
  dataCompleteness: number;
  dataStatus: "live" | "partial" | "empty";
  fleetHealth: {
    score: number | null;
    status: FleetHealthStatus;
    confidence: number;
    factors: FleetHealthFactor[];
  };
  /** Patch 51C.1 — Organization Health rollup (separate from fleet score). */
  organizationHealth: {
    enabled: boolean;
    overallScore: number | null;
    classification: string;
    availableCategories: number;
    href: string;
    message?: string;
  } | null;
  /** Patch 51C.1 — Decision + predictive recommendations inbox. */
  recommendations: Array<{
    id: string;
    title: string;
    reason: string;
    href: string;
    source: string;
    severity: string;
  }>;
  /** Soft flag for 51C.1 UI extensions. */
  enterpriseIntelligenceEnabled: boolean;
  kpis: ExecutiveKpis;
  priorities: ExecutivePriorityItem[];
  aiBriefing: ExecutiveBriefing | null;
  panels: EnterpriseStatusPanel[];
  empty: boolean;
  emptyMessage: string | null;
};
