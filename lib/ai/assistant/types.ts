/**
 * Patch 51A.1 Part 3 — Assistant domain types & validated query plan.
 */

export const AI_REQUEST_TYPES = [
  "RECORD_SEARCH",
  "RECORD_COUNT",
  "SUMMARY",
  "TREND",
  "COMPARISON",
  "STATUS_CHECK",
  "DATA_QUALITY_CHECK",
  "AI_INSIGHT_SEARCH",
  "FLEET_HEALTH",
  "SERVICE_ANALYSIS",
  "PM_ANALYSIS",
  "INVENTORY_ANALYSIS",
  "PARTS_ANALYSIS",
  "CUSTOMER_ANALYSIS",
  "TECHNICIAN_ANALYSIS",
  "HELP",
  "UNSUPPORTED",
] as const;

export type AiRequestType = (typeof AI_REQUEST_TYPES)[number];

export const AI_SEARCH_MODULES = [
  "CUSTOMERS",
  "SITES",
  "MACHINES",
  "SERVICE_CALLS",
  "PM",
  "METERS",
  "INVENTORY",
  "PARTS",
  "PARTS_ORDERS",
  "TECHNICIANS",
  "AI_INSIGHTS",
  "DATA_QUALITY",
  "AUDIT",
] as const;

export type AiSearchModule = (typeof AI_SEARCH_MODULES)[number];

export const AI_SEARCH_OPERATORS = [
  "EQUALS",
  "NOT_EQUALS",
  "CONTAINS",
  "STARTS_WITH",
  "IN",
  "NOT_IN",
  "GREATER_THAN",
  "GREATER_THAN_OR_EQUAL",
  "LESS_THAN",
  "LESS_THAN_OR_EQUAL",
  "BETWEEN",
  "IS_NULL",
  "IS_NOT_NULL",
] as const;

export type AiSearchOperator = (typeof AI_SEARCH_OPERATORS)[number];

export const ALLOWED_FILTER_FIELDS = new Set([
  "customerName",
  "siteName",
  "machineId",
  "serialNumber",
  "model",
  "status",
  "priority",
  "technicianName",
  "partNumber",
  "workOrderNumber",
  "organization",
  "severity",
  "insightType",
  "sourceModule",
  "q",
  "meterTotal",
]);

export type AiSearchFilter = {
  field: string;
  operator: AiSearchOperator;
  value?: string | number | string[] | null;
};

export type AiSearchSort = {
  field: string;
  direction: "asc" | "desc";
};

export type AiSearchPlan = {
  requestType: AiRequestType;
  modules: AiSearchModule[];
  filters: AiSearchFilter[];
  sort?: AiSearchSort[];
  dateRange?: { from?: string; to?: string; label?: string };
  groupBy?: string[];
  limit: number;
  includeSummary: boolean;
  includeSources: boolean;
};

export type AiSourceCitation = {
  sourceType: string;
  recordId: string;
  displayLabel: string;
  href: string | null;
  fieldSummary: string | null;
  timestamp: string | null;
  metadata?: Record<string, unknown>;
};

export const AI_FEEDBACK_RATINGS = [
  "HELPFUL",
  "NOT_HELPFUL",
  "INCORRECT",
  "MISSING_INFORMATION",
  "UNSAFE_OR_INAPPROPRIATE",
] as const;

export type AiFeedbackRating = (typeof AI_FEEDBACK_RATINGS)[number];

export const ADVISORY_ASSISTANT =
  "AI-generated answers are advisory and may be incomplete or inaccurate. Review the cited Matrix records before making operational decisions.";

export type ClarificationOption = {
  id: string;
  label: string;
  value: string;
  module?: AiSearchModule;
};

export type AssistantAnswer = {
  content: string;
  requestType: AiRequestType;
  plan: AiSearchPlan | null;
  confidence: number;
  dataBasis: "LIVE" | "CACHED" | "STORED_ANALYSIS" | "MIXED";
  answerFormat:
    | "SUMMARY"
    | "COUNT"
    | "LIST"
    | "TABLE"
    | "COMPARISON"
    | "TREND"
    | "WARNING"
    | "EMPTY"
    | "CLARIFICATION"
    | "UNSUPPORTED"
    | "HELP"
    | "ERROR";
  sources: AiSourceCitation[];
  followUps: string[];
  limitations: string | null;
  retrievalSummary: string | null;
  appliedFilters: Record<string, unknown>;
  clarificationOptions?: ClarificationOption[];
  analyzedAt: string;
  totalCount?: number;
};
