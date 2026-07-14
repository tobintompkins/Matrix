/**
 * Patch 48 — Matrix Assist shared types.
 */

export type DiagnosticSessionStatus =
  | "DRAFT"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type StepResult =
  | "NOT_STARTED"
  | "PASSED"
  | "FAILED"
  | "NOT_APPLICABLE";

export type AssistMessageRole = "USER" | "ASSISTANT" | "SYSTEM";

export type ConfidenceLabel = "Low" | "Moderate" | "High";

export type FeedbackRating =
  | "HELPFUL"
  | "NOT_HELPFUL"
  | "PARTIALLY_HELPFUL";

export type SymptomCategory =
  | "Paper Feed"
  | "Paper Jam"
  | "Print Quality"
  | "Ink Delivery"
  | "Drum"
  | "Scanner"
  | "Finisher"
  | "Network"
  | "Controller"
  | "Power"
  | "Noise"
  | "Vibration"
  | "Error Code"
  | "Preventive Maintenance"
  | "Other";

export type SuggestedCause = {
  title: string;
  confidence: ConfidenceLabel;
  reason: string;
};

export type EvidenceRef = {
  label: string;
  href?: string;
  kind: "service_call" | "pm" | "meter" | "observation" | "template" | "other";
};

export type RecommendedAction = {
  type:
    | "Inspect"
    | "Clean"
    | "Test"
    | "Adjust"
    | "Re-seat"
    | "Review documentation"
    | "Compare with service history"
    | "Replace part"
    | "Escalate"
    | "Monitor"
    | "Schedule follow-up";
  detail: string;
};

export type PartSuggestion = {
  partNumber: string;
  description: string;
  compatibleModel?: string;
  assembly?: string;
  callout?: string;
  available?: number | null;
  reserved?: number | null;
  warehouse?: string | null;
  /** True when stock was intentionally hidden due to permissions */
  stockHidden?: boolean;
};

export type DiagnosticInput = {
  symptom: string;
  observations?: string;
  modelHint?: string;
  errorCode?: string;
  contextSummary: string;
  evidence: EvidenceRef[];
  templateSteps?: Array<{ title: string; instructions?: string }>;
  hasVerifiedModelProcedure: boolean;
};

export type DiagnosticResponse = {
  symptomConfirmation: string[];
  safetyNotes: string[];
  inspectionChecks: Array<{ title: string; instructions: string }>;
  likelyCauses: SuggestedCause[];
  recommendedActions: RecommendedAction[];
  evidence: EvidenceRef[];
  summary: string;
  modelSpecificNote?: string;
  isSample: boolean;
  isUnverifiedInterpretation?: boolean;
};

export type ServiceHistoryInput = {
  contextSummary: string;
  records: Array<{
    id: string;
    label: string;
    href?: string;
    detail: string;
    date?: string;
  }>;
};

export type ServiceHistorySummary = {
  bullets: string[];
  evidence: EvidenceRef[];
  isSample: boolean;
};

export type ServiceNotesInput = {
  customerComplaint?: string;
  inspection?: string;
  tests?: string;
  partsCleaned?: string;
  partsReplaced?: string;
  adjustments?: string;
  finalResult?: string;
  followUp?: string;
  machineStatus?: string;
};

export type ServiceNotesDraft = {
  sections: Array<{ heading: string; body: string }>;
  fullText: string;
  isSample: boolean;
  label: "AI-generated draft — review before saving";
};

export type MatrixAssistContext = {
  serviceCallId?: string;
  workOrderNumber?: string;
  customerName?: string;
  siteOrLocation?: string;
  machineId?: string;
  printerModel?: string;
  serialNumber?: string;
  assetTag?: string;
  reportedIssue?: string;
  priority?: string;
  status?: string;
  assignedTechnician?: string;
  recentMeter?: number | null;
  recentServiceHistory: Array<{
    id: string;
    label: string;
    href?: string;
    detail: string;
    date?: string;
  }>;
  previousSymptoms: string[];
  recentlyReplacedParts: string[];
  openPmNotes: string[];
  knownAlerts: string[];
  technicianObservations?: string;
  /** Fields intentionally excluded from provider payload */
  redactedFields: string[];
};

export const MAX_ASSIST_INPUT_LENGTH = 4000;
