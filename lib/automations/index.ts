export type * from "./types";
export { AUTOMATION_TRIGGERS, getTrigger, listAvailableTriggers } from "./registry/triggers";
export { AUTOMATION_ACTIONS, getAction, executeRegisteredAction } from "./registry/actions";
export { evaluateConditionGroup, evaluateCondition } from "./engine/evaluate-conditions";
export { requiresApproval, classifyActionRisk } from "./engine/approval-policy";
export { buildIdempotencyKey, hourBucket } from "./engine/idempotency";
export { resolvePath } from "./engine/path";
export {
  executeAutomation,
  continueAfterApproval,
  processAutomationEvent,
  runDueScheduledAutomations,
  getOrCreateSettings,
  computeNextRun,
} from "./engine/execute-automation";
export { emitAutomationEvent } from "./emit";
export {
  ensureAutomationFrameworkSeeded,
  listAutomations,
  getAutomation,
  createAutomation,
  updateAutomation,
  duplicateAutomation,
  getAutomationOverview,
} from "./service";
export { SYSTEM_TEMPLATES } from "./templates/system-templates";
