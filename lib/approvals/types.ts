/**
 * Patch 50A — Enterprise Approval Center types.
 */

export const APPROVAL_STATUSES = [
  "DRAFT",
  "PENDING",
  "IN_REVIEW",
  "RETURNED_FOR_REVISION",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
  "ESCALATED",
  "COMPLETED",
  "ARCHIVED",
] as const;

export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const APPROVAL_PRIORITIES = [
  "CRITICAL",
  "HIGH",
  "NORMAL",
  "LOW",
] as const;

export type ApprovalPriority = (typeof APPROVAL_PRIORITIES)[number];

export const APPROVAL_TYPES = [
  "PARTS_ORDER",
  "PURCHASE_REQUEST",
  "INVENTORY_ADJUSTMENT",
  "WARRANTY_CLAIM",
  "PM_SCHEDULE_CHANGE",
  "USER_ACCESS_REQUEST",
  "EXPENSE_REQUEST",
  "EMERGENCY_REQUEST",
  "GENERAL_REQUEST",
] as const;

export type ApprovalType = (typeof APPROVAL_TYPES)[number];

export const STEP_STATUSES = [
  "WAITING",
  "ACTIVE",
  "APPROVED",
  "REJECTED",
  "SKIPPED",
  "CANCELLED",
] as const;

export type StepStatus = (typeof STEP_STATUSES)[number];

export const DECISIONS = [
  "APPROVED",
  "REJECTED",
  "RETURNED",
  "ESCALATED",
  "DELEGATED",
  "CANCELLED",
] as const;

export type ApprovalDecisionKind = (typeof DECISIONS)[number];

export const ASSIGNMENT_TYPES = [
  "DIRECT",
  "ROLE_BASED",
  "DELEGATED",
  "ESCALATED",
  "REASSIGNED",
] as const;

export type AssignmentType = (typeof ASSIGNMENT_TYPES)[number];

export type ConditionOperator =
  | "EQUALS"
  | "NOT_EQUALS"
  | "GREATER_THAN"
  | "GREATER_THAN_OR_EQUAL"
  | "LESS_THAN"
  | "LESS_THAN_OR_EQUAL"
  | "IN"
  | "NOT_IN"
  | "CONTAINS"
  | "IS_EMPTY"
  | "IS_NOT_EMPTY";

export type RuleCondition = {
  operator: ConditionOperator;
  value?: unknown;
};

export type RuleConditions = Record<string, RuleCondition>;

export type WorkflowStepDefinition = {
  stepNumber: number;
  name: string;
  approverType?: "PERMISSION" | "ROLE" | "USER";
  requiredPermission?: string;
  requiredRoleId?: string;
  assignedUserId?: string;
  minimumApprovals?: number;
  optional?: boolean;
  dueInHours?: number;
};

export type WorkflowDefinition = {
  steps: WorkflowStepDefinition[];
};

export type ApprovalRuleContext = {
  approvalType: string;
  sourceModule?: string | null;
  priority?: string | null;
  departmentId?: string | null;
  requestedAmount?: number | null;
  currency?: string | null;
  emergencyFlag?: boolean;
  inventoryAdjustmentPercentage?: number | null;
  requesterRole?: string | null;
  machineId?: string | null;
  customerId?: string | null;
  serviceCallId?: string | null;
  organizationId: string;
};

export type SlaClassification = "Healthy" | "Warning" | "At Risk" | "Overdue";

export type CreateApprovalInput = {
  title: string;
  description?: string | null;
  businessJustification?: string | null;
  approvalType: string;
  sourceModule?: string | null;
  sourceRecordId?: string | null;
  priority?: ApprovalPriority;
  requesterDepartmentId?: string | null;
  requestedAmount?: number | null;
  currency?: string | null;
  dueAt?: string | null;
  customerId?: string | null;
  machineId?: string | null;
  serviceCallId?: string | null;
  partsOrderId?: string | null;
  submit?: boolean;
};

export type UpdateDraftInput = Partial<
  Omit<CreateApprovalInput, "submit">
> & { id: string };

export type ListApprovalsFilter = {
  organizationId: string;
  status?: string;
  priority?: string;
  approvalType?: string;
  departmentId?: string;
  requesterUserId?: string;
  assignedApproverUserId?: string;
  submittedFrom?: string;
  submittedTo?: string;
  dueFrom?: string;
  dueTo?: string;
  overdueOnly?: boolean;
  awaitingMe?: boolean;
  myRequests?: boolean;
  escalatedOnly?: boolean;
  archived?: boolean;
  q?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  actorUserId: string;
  canViewAll: boolean;
};

export const CLOSED_STATUSES: ApprovalStatus[] = [
  "APPROVED",
  "REJECTED",
  "CANCELLED",
  "COMPLETED",
  "ARCHIVED",
];

export const OPEN_STATUSES: ApprovalStatus[] = [
  "PENDING",
  "IN_REVIEW",
  "RETURNED_FOR_REVISION",
  "ESCALATED",
];
