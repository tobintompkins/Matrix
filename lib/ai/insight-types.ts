/**
 * Patch 51A.1 Part 2 — AI insight domain constants & DTOs.
 */

export const AI_INSIGHT_TYPES = [
  "SERVICE_RISK",
  "REPEAT_FAILURE",
  "PM_DUE_RISK",
  "PM_OVERDUE",
  "METER_ANOMALY",
  "INVENTORY_RISK",
  "PART_USAGE_ANOMALY",
  "DATA_QUALITY",
  "CUSTOMER_IMPACT",
  "TECHNICIAN_WORKLOAD",
  "DOWNTIME_RISK",
  "COST_RISK",
  "PROCESS_GAP",
  "DOCUMENTATION_GAP",
  "OPERATIONAL_OPPORTUNITY",
  "GENERAL_RECOMMENDATION",
] as const;

export type AiInsightType = (typeof AI_INSIGHT_TYPES)[number];

export const AI_INSIGHT_SEVERITIES = [
  "INFO",
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
] as const;

export type AiInsightSeverity = (typeof AI_INSIGHT_SEVERITIES)[number];

export const AI_INSIGHT_STATUSES = [
  "NEW",
  "REVIEWING",
  "ACKNOWLEDGED",
  "ACTION_REQUIRED",
  "RESOLVED",
  "DISMISSED",
  "ARCHIVED",
] as const;

export type AiInsightStatus = (typeof AI_INSIGHT_STATUSES)[number];

export const AI_RISK_CATEGORIES = [
  "ACT_NOW",
  "PLAN_NEXT",
  "MONITOR",
  "LOW_PRIORITY",
] as const;

export type AiRiskCategory = (typeof AI_RISK_CATEGORIES)[number];

export const AI_SOURCE_MODULES = [
  "SERVICE",
  "PM",
  "FLEET",
  "INVENTORY",
  "DATA_QUALITY",
  "GENERAL",
] as const;

export type AiSourceModule = (typeof AI_SOURCE_MODULES)[number];

export const AI_ANALYSIS_RUN_STATUSES = [
  "QUEUED",
  "RUNNING",
  "COMPLETED",
  "PARTIALLY_COMPLETED",
  "FAILED",
  "CANCELLED",
] as const;

export type AiAnalysisRunStatus = (typeof AI_ANALYSIS_RUN_STATUSES)[number];

export const AI_HEALTH_STATES = [
  "HEALTHY",
  "DEGRADED",
  "STALE",
  "UNAVAILABLE",
  "NOT_CONFIGURED",
] as const;

export type AiHealthState = (typeof AI_HEALTH_STATES)[number];

/** Valid status transitions (from → allowed next). */
export const AI_INSIGHT_TRANSITIONS: Record<
  AiInsightStatus,
  AiInsightStatus[]
> = {
  NEW: ["REVIEWING", "ACKNOWLEDGED", "ACTION_REQUIRED", "DISMISSED"],
  REVIEWING: ["ACKNOWLEDGED", "ACTION_REQUIRED", "DISMISSED", "RESOLVED"],
  ACKNOWLEDGED: ["ACTION_REQUIRED", "REVIEWING", "RESOLVED", "DISMISSED"],
  ACTION_REQUIRED: ["RESOLVED", "REVIEWING", "DISMISSED"],
  RESOLVED: ["ARCHIVED"],
  DISMISSED: ["NEW", "ARCHIVED"],
  ARCHIVED: [],
};

export type AiOpsInsightDto = {
  id: string;
  organizationId: string;
  analysisRunId: string | null;
  insightType: AiInsightType;
  sourceModule: AiSourceModule;
  title: string;
  summary: string;
  explanation: string;
  recommendedAction: string;
  severity: AiInsightSeverity;
  confidence: number;
  status: AiInsightStatus;
  riskCategory: AiRiskCategory;
  supportingEvidence: Record<string, unknown> | null;
  limitations: string | null;
  analysisVersion: string;
  customerId: string | null;
  customerName: string | null;
  siteId: string | null;
  siteName: string | null;
  machineId: string | null;
  machineLabel: string | null;
  serviceCallId: string | null;
  pmRecordId: string | null;
  inventoryItemId: string | null;
  partId: string | null;
  dataQualityIssueId: string | null;
  relatedRecordHref: string | null;
  assignedReviewerId: string | null;
  assignedReviewerName: string | null;
  reviewNotes: string | null;
  dismissalReason: string | null;
  resolutionSummary: string | null;
  actionTaken: string | null;
  followUpDate: string | null;
  resolvedAt: string | null;
  archivedAt: string | null;
  acknowledgedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AiOpsInsightEventDto = {
  id: string;
  insightId: string;
  actorUserId: string | null;
  actorName: string | null;
  action: string;
  previousStatus: string | null;
  newStatus: string | null;
  note: string | null;
  createdAt: string;
};

export type AiOpsAnalysisRunDto = {
  id: string;
  organizationId: string;
  status: AiAnalysisRunStatus;
  requestedByUserId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  recordsAnalyzed: number;
  recordsSkipped: number;
  insightsCreated: number;
  errorSummary: string | null;
  analysisVersion: string;
  rulesVersion: string;
  cancelRequested: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AiExecutiveBriefing = {
  text: string;
  overallCondition: string;
  mostUrgentRisk: string;
  mostImportantOpportunity: string;
  highestPriorityAction: string;
  majorTrend: string;
  dataGaps: string;
  analyzedAt: string;
  confidence: number;
  insufficientData: boolean;
};

export type AiDashboardSummary = {
  serviceStatus: string;
  lastSuccessfulAnalysisAt: string | null;
  activeInsights: number;
  criticalRecommendations: number;
  unresolvedAnomalies: number;
  pendingHumanReviews: number;
  dataFreshness: string;
  averageConfidence: number;
  dataQualityWarnings: number;
  coverage: {
    machinesAnalyzed: number;
    customersAnalyzed: number;
    serviceCallsAnalyzed: number;
    pmRecordsAnalyzed: number;
    inventoryRecordsAnalyzed: number;
    excludedSources: string[];
  };
  moduleCounts: {
    SERVICE: number;
    PM: number;
    FLEET: number;
    INVENTORY: number;
    DATA_QUALITY: number;
    GENERAL: number;
  };
  briefing: AiExecutiveBriefing;
  quickLinks: Array<{ label: string; href: string }>;
  advisoryNotice: string;
};
