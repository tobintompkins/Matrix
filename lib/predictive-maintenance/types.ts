/**
 * Patch 51A.3 — Predictive Maintenance Intelligence types.
 * Deterministic scoring first; AI explanations are optional and separate.
 */

export const SCORING_VERSION = "pm-pred-v1";
export const AI_EXPLANATION_VERSION = "pm-pred-ai-v1";

export type PredictiveRiskLevel =
  | "LOW"
  | "MODERATE"
  | "HIGH"
  | "CRITICAL"
  | "UNKNOWN";

export type PredictiveRecommendationType =
  | "INSPECT"
  | "SCHEDULE_PM"
  | "EXPEDITE_PM"
  | "REVIEW_REPEAT_FAILURE"
  | "CHECK_METER"
  | "CHECK_PARTS"
  | "REVIEW_DOWNTIME"
  | "CREATE_SERVICE_CALL"
  | "MONITOR"
  | "DATA_CORRECTION";

export type PredictiveAlertType =
  | "HEALTH_SCORE_DROP"
  | "CRITICAL_RISK"
  | "PM_OVERDUE_RISK"
  | "RAPID_USAGE_INCREASE"
  | "REPEAT_FAILURE"
  | "DOWNTIME_PATTERN"
  | "MISSING_DATA"
  | "PARTS_RISK";

export type MachineDataReadiness = {
  ready: boolean;
  score: number;
  missingFields: string[];
  warnings: string[];
  usableSignals: string[];
  excludedSignals: string[];
};

export type ScoreFactor = {
  factor: string;
  points: number;
  reason: string;
};

export type ScoreBreakdown = {
  baseScore: number;
  deductions: ScoreFactor[];
  bonuses: ScoreFactor[];
  finalScore: number;
};

export type PredictiveRiskFactor = {
  key: string;
  severity: "INFO" | "WARNING" | "HIGH" | "CRITICAL";
  scoreImpact: number;
  confidence: number;
  title: string;
  explanation: string;
  evidence: Array<{
    entityType: string;
    entityId?: string;
    date?: string;
    summary: string;
  }>;
};

export type MaintenanceForecastResult = {
  officialDueMeter: number | null;
  officialDueDate: string | null;
  predictedDueDate: string | null;
  windowStart: string | null;
  windowEnd: string | null;
  predictedMeterAtDue: number | null;
  daysRemaining: number | null;
  impressionsRemaining: number | null;
  confidenceScore: number;
  explanation: string;
  isOfficial: boolean;
};

export type DraftRecommendation = {
  recommendationType: PredictiveRecommendationType;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  title: string;
  description: string;
  reason: string;
  confidenceScore: number;
  dedupeKey: string;
};

export type DraftAlert = {
  alertType: PredictiveAlertType;
  severity: "INFO" | "WARNING" | "HIGH" | "CRITICAL";
  title: string;
  message: string;
  dedupeKey: string;
};

export type MachinePredictiveInput = {
  machineId: string;
  assetTag?: string | null;
  nickname?: string | null;
  printerModel?: string | null;
  customerName?: string | null;
  siteName?: string | null;
  assignedTechnician?: string | null;
  active: boolean;
  currentMeterCount?: number | null;
  lastPmCount?: number | null;
  lastPmAt?: string | null;
  pmInterval?: number | null;
  nextPmDueCount?: number | null;
  installDate?: string | null;
  meterHistory: Array<{
    meterCount: number;
    recordedAt: string;
    previousCount?: number | null;
  }>;
  serviceCalls: Array<{
    id: string;
    status: string;
    priority: string;
    issueTitle: string;
    symptoms?: string;
    createdAt: string;
    updatedAt: string;
    isEmergency?: boolean;
  }>;
  machineStatus?: string | null;
};

export type EvaluationResult = {
  machineId: string;
  healthScore: number;
  riskLevel: PredictiveRiskLevel;
  dataQualityScore: number;
  confidenceScore: number;
  failureRiskScore: number;
  pmUrgencyScore: number;
  usageStressScore: number;
  repeatIssueScore: number;
  downtimeRiskScore: number;
  primaryRiskReason: string;
  breakdown: ScoreBreakdown;
  riskFactors: PredictiveRiskFactor[];
  forecast: MaintenanceForecastResult;
  readiness: MachineDataReadiness;
  recommendations: DraftRecommendation[];
  alerts: DraftAlert[];
  inputSummary: Record<string, unknown>;
  scoringVersion: string;
};

export type DefaultPredictiveSettings = {
  enabled: boolean;
  scheduledEvaluationEnabled: boolean;
  evaluationFrequency: string;
  healthScoreWarningThreshold: number;
  healthScoreCriticalThreshold: number;
  pmDueSoonDays: number;
  staleMeterDays: number;
  repeatFailureLookbackDays: number;
  repeatFailureThreshold: number;
  downtimeLookbackDays: number;
  usageSpikePercent: number;
  minimumDataQualityScore: number;
  minimumConfidenceForAlert: number;
  autoCreateRecommendations: boolean;
  autoCreateInternalAlerts: boolean;
  requireApprovalForServiceCallCreation: boolean;
  retentionDays: number;
  scoringVersion: string;
};

export const DEFAULT_PREDICTIVE_SETTINGS: DefaultPredictiveSettings = {
  enabled: true,
  scheduledEvaluationEnabled: false,
  evaluationFrequency: "daily",
  healthScoreWarningThreshold: 70,
  healthScoreCriticalThreshold: 40,
  pmDueSoonDays: 14,
  staleMeterDays: 45,
  repeatFailureLookbackDays: 45,
  repeatFailureThreshold: 3,
  downtimeLookbackDays: 90,
  usageSpikePercent: 40,
  minimumDataQualityScore: 40,
  minimumConfidenceForAlert: 50,
  autoCreateRecommendations: true,
  autoCreateInternalAlerts: true,
  requireApprovalForServiceCallCreation: true,
  retentionDays: 180,
  scoringVersion: SCORING_VERSION,
};

export const DEFAULT_WEIGHTS = {
  pmOverdue: 22,
  pmDueSoon: 10,
  repeatFailure: 15,
  openEmergency: 18,
  staleMeter: 12,
  usageSpike: 8,
  recentSuccessfulPm: 5,
  inactiveMachine: 0,
};
