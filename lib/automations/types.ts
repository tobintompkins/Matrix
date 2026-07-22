/**
 * Patch 51A.2 — AI Automation Framework types.
 */

export const AUTOMATION_STATUSES = [
  "DRAFT",
  "ACTIVE",
  "PAUSED",
  "DISABLED",
  "ARCHIVED",
] as const;
export type AutomationStatus = (typeof AUTOMATION_STATUSES)[number];

export const AUTOMATION_TRIGGER_TYPES = [
  "EVENT",
  "SCHEDULE",
  "MANUAL",
  "AI_MONITOR",
] as const;
export type AutomationTriggerType = (typeof AUTOMATION_TRIGGER_TYPES)[number];

export const AUTOMATION_APPROVAL_MODES = [
  "NONE",
  "BEFORE_RUN",
  "BEFORE_HIGH_IMPACT_ACTION",
  "ALWAYS",
] as const;
export type AutomationApprovalMode = (typeof AUTOMATION_APPROVAL_MODES)[number];

export const AUTOMATION_RISK_LEVELS = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
] as const;
export type AutomationRiskLevel = (typeof AUTOMATION_RISK_LEVELS)[number];

export const AUTOMATION_EXECUTION_STATUSES = [
  "QUEUED",
  "RUNNING",
  "WAITING_APPROVAL",
  "SUCCEEDED",
  "PARTIALLY_SUCCEEDED",
  "FAILED",
  "CANCELLED",
  "SKIPPED",
] as const;
export type AutomationExecutionStatus =
  (typeof AUTOMATION_EXECUTION_STATUSES)[number];

export type AutomationConditionOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "does_not_contain"
  | "starts_with"
  | "ends_with"
  | "greater_than"
  | "greater_than_or_equal"
  | "less_than"
  | "less_than_or_equal"
  | "is_empty"
  | "is_not_empty"
  | "is_true"
  | "is_false"
  | "is_in"
  | "is_not_in"
  | "before"
  | "after"
  | "within_next_days"
  | "older_than_hours"
  | "older_than_days"
  | "changed_from"
  | "changed_to"
  | "ai_classification"
  | "ai_risk_score"
  | "ai_summary_match"
  | "ai_anomaly_check";

export type AutomationCondition = {
  id?: string;
  field: string;
  operator: AutomationConditionOperator;
  value?: unknown;
  minConfidence?: number;
  optional?: boolean;
};

export type AutomationConditionGroup = {
  mode: "ALL" | "ANY";
  conditions: Array<AutomationCondition | AutomationConditionGroup>;
};

export type AutomationActionDef = {
  id?: string;
  actionKey: string;
  params?: Record<string, unknown>;
  optional?: boolean;
  highImpact?: boolean;
};

export type AutomationActionResult = {
  success: boolean;
  actionKey: string;
  entityType?: string;
  entityId?: string;
  message: string;
  data?: unknown;
  skipped?: boolean;
  dryRun?: boolean;
  error?: { code: string; message: string };
};

export type ConditionEvalResult = {
  matched: boolean;
  field?: string;
  operator?: string;
  reason: string;
  confidence?: number;
  aiGenerated?: boolean;
};

export type TriggerDefinition = {
  key: string;
  displayName: string;
  description: string;
  category: string;
  entityType: string;
  available: boolean;
  comingSoon?: boolean;
  requiredPermission?: string;
  examplePayload: Record<string, unknown>;
};

export type ActionDefinition = {
  key: string;
  displayName: string;
  description: string;
  category: string;
  available: boolean;
  highImpact: boolean;
  retryable: boolean;
  requiredPermission?: string;
  comingSoon?: boolean;
};
