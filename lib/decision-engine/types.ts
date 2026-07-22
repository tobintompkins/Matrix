/**
 * Patch 51A.4 — Enterprise Decision Engine types & thresholds.
 */

export const DECISION_RULES_VERSION = "decision-v1";
export const DECISION_AI_EXPLANATION_VERSION = "decision-ai-v1";

export type DecisionType =
  | "PREDICTIVE_MAINTENANCE"
  | "SERVICE_CALL_PRIORITY"
  | "REPEAT_FAILURE"
  | "SLA_RISK"
  | "TECHNICIAN_ASSIGNMENT"
  | "PARTS_SHORTAGE"
  | "REORDER_RECOMMENDATION"
  | "INVENTORY_TRANSFER"
  | "CUSTOMER_RISK"
  | "MACHINE_REPLACEMENT_REVIEW"
  | "PM_SCHEDULING"
  | "WORKLOAD_BALANCING"
  | "COST_AVOIDANCE"
  | "AUTOMATION_REVIEW"
  | "OTHER";

export type DecisionStatus =
  | "NEW"
  | "REVIEW_REQUIRED"
  | "APPROVED"
  | "REJECTED"
  | "DEFERRED"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "EXPIRED"
  | "CANCELLED";

export type DecisionPriority =
  | "CRITICAL"
  | "HIGH"
  | "MEDIUM"
  | "LOW"
  | "INFORMATIONAL";

export type DecisionScores = {
  riskScore: number;
  urgencyScore: number;
  businessImpactScore: number;
  confidenceScore: number;
  slaImpactScore: number;
  overallDecisionScore: number;
};

export type DecisionEvidenceFact = {
  label: string;
  value: string | number | boolean | null;
  available: boolean;
  source?: string;
};

export type DecisionEvidenceSnapshot = {
  generatedAt: string;
  facts: DecisionEvidenceFact[];
  ruleMatches: string[];
  links: Array<{ label: string; href: string }>;
};

export type AlternativeAction = {
  action: string;
  reason: string;
};

export type DraftDecision = {
  decisionType: DecisionType;
  title: string;
  summary: string;
  detailedReasoning: string;
  sourceType: string;
  sourceId?: string | null;
  fingerprint: string;
  machineId?: string | null;
  customerId?: string | null;
  siteId?: string | null;
  serviceCallId?: string | null;
  partId?: string | null;
  inventoryLocationId?: string | null;
  technicianId?: string | null;
  priority: DecisionPriority;
  scores: DecisionScores;
  estimatedDowntimeMinutes?: number | null;
  estimatedLaborMinutes?: number | null;
  estimatedCost?: number | null;
  estimatedCostAvoidance?: number | null;
  slaImpact?: string | null;
  recommendedAction: string;
  alternativeActions: AlternativeAction[];
  evidence: DecisionEvidenceSnapshot;
  highImpact: boolean;
  dueAt?: string | null;
};

/** Open statuses that block duplicate fingerprints. */
export const OPEN_DECISION_STATUSES: DecisionStatus[] = [
  "NEW",
  "REVIEW_REQUIRED",
  "APPROVED",
  "DEFERRED",
  "ASSIGNED",
  "IN_PROGRESS",
];

export const HIGH_IMPACT_DECISION_TYPES: DecisionType[] = [
  "REORDER_RECOMMENDATION",
  "INVENTORY_TRANSFER",
  "MACHINE_REPLACEMENT_REVIEW",
  "CUSTOMER_RISK",
  "COST_AVOIDANCE",
];

export type DecisionEngineWeights = {
  riskWeight: number;
  urgencyWeight: number;
  businessImpactWeight: number;
  slaWeight: number;
  confidenceWeight: number;
};

export const DEFAULT_DECISION_WEIGHTS: DecisionEngineWeights = {
  riskWeight: 0.35,
  urgencyWeight: 0.25,
  businessImpactWeight: 0.2,
  slaWeight: 0.1,
  confidenceWeight: 0.1,
};

export const DECISION_THRESHOLDS = {
  criticalOverall: 80,
  highOverall: 65,
  mediumOverall: 45,
  criticalRisk: 75,
  highUrgency: 70,
  lowConfidence: 40,
};
