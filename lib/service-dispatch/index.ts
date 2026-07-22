export type * from "./types";

export {
  DEFAULT_PROBLEM_CATEGORIES,
  listEnabledCategories,
  reorderCategories,
  upsertCategory,
} from "./categories";

export {
  isValidServiceTicketNumber,
  nextServiceTicketNumber,
  resetTicketNumberingForTests,
} from "./numbering";

export {
  assertDispatchTransition,
  canTransitionDispatch,
  DISPATCH_STATUS_ORDER,
  getAllowedDispatchTransitions,
  isActiveDispatchStatus,
  isUnassignedStatus,
  normalizeLegacyStatus,
  PRIORITY_DEFINITIONS,
} from "./workflow";

export {
  buildSlaSnapshot,
  DEFAULT_SLA_RULES,
  evaluateSlaState,
  resolveSlaRule,
  slaWarningMessages,
} from "./sla";

export { evaluateEscalations } from "./escalation";
export type { EscalationAction, EscalationEvent, EscalationTrigger } from "./escalation";

export {
  recommendTechnicians,
  SEED_TECHNICIANS,
  updateTechnicianStatus,
} from "./technicians";

export { detectRepeatFailures } from "./repeat-failure";
export type { TicketLite } from "./repeat-failure";

export {
  buildServiceReport,
  diagnosticToResolutionSummary,
  emptyDiagnostic,
  redactInternalTicketFields,
  renderServiceReportHtml,
  toCustomerVisibleTicket,
} from "./report";

export {
  acceptAssignment,
  addLabor,
  assignTechnician,
  boardColumns,
  completeTicketWithSignature,
  computeDispatchMetrics,
  createDispatchTicket,
  declineAssignment,
  filterDispatchBoard,
  getCustomerView,
  getDiagnostic,
  getMxTicketNumber,
  getOfflineDraft,
  getPmOpportunity,
  getRecommendationsForTicket,
  getRepeatFailureFlags,
  getSlaForTicket,
  getSlaWarnings,
  getTicketMeta,
  listCategories,
  listDiagnosticTemplates,
  listLabor,
  listSlaRules,
  listTechnicians,
  listTicketAudit,
  listTicketUpdates,
  postCustomerVisibleUpdate,
  markWaitingForParts,
  resetDispatchForTests,
  runEscalationsForTicket,
  saveCategories,
  saveDiagnostic,
  saveOfflineDraft,
  transitionDispatchTicket,
} from "./repository";
