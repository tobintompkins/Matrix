/**
 * Patch 50A — Approval rule evaluation (server-side only).
 * Never executes arbitrary code from JSON.
 */

import { prisma } from "@/lib/db/prisma";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import type {
  ApprovalRuleContext,
  ConditionOperator,
  RuleCondition,
  RuleConditions,
  WorkflowDefinition,
  WorkflowStepDefinition,
} from "./types";

function parseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function compareValues(
  left: unknown,
  operator: ConditionOperator,
  right: unknown,
): boolean {
  switch (operator) {
    case "IS_EMPTY":
      return (
        left === null ||
        left === undefined ||
        left === "" ||
        (Array.isArray(left) && left.length === 0)
      );
    case "IS_NOT_EMPTY":
      return !compareValues(left, "IS_EMPTY", right);
    case "EQUALS":
      return left === right || String(left) === String(right);
    case "NOT_EQUALS":
      return !compareValues(left, "EQUALS", right);
    case "GREATER_THAN":
      return Number(left) > Number(right);
    case "GREATER_THAN_OR_EQUAL":
      return Number(left) >= Number(right);
    case "LESS_THAN":
      return Number(left) < Number(right);
    case "LESS_THAN_OR_EQUAL":
      return Number(left) <= Number(right);
    case "IN":
      return Array.isArray(right) && right.map(String).includes(String(left));
    case "NOT_IN":
      return Array.isArray(right) && !right.map(String).includes(String(left));
    case "CONTAINS":
      return String(left ?? "")
        .toLowerCase()
        .includes(String(right ?? "").toLowerCase());
    default:
      return false;
  }
}

function getContextValue(
  ctx: ApprovalRuleContext,
  field: string,
): unknown {
  const map: Record<string, unknown> = {
    approvalType: ctx.approvalType,
    sourceModule: ctx.sourceModule,
    priority: ctx.priority,
    departmentId: ctx.departmentId,
    requestedAmount: ctx.requestedAmount,
    currency: ctx.currency,
    emergencyFlag: ctx.emergencyFlag,
    inventoryAdjustmentPercentage: ctx.inventoryAdjustmentPercentage,
    requesterRole: ctx.requesterRole,
    machineId: ctx.machineId,
    customerId: ctx.customerId,
    serviceCallId: ctx.serviceCallId,
    organizationId: ctx.organizationId,
  };
  return map[field];
}

export function evaluateCondition(
  fieldValue: unknown,
  condition: RuleCondition,
): boolean {
  return compareValues(fieldValue, condition.operator, condition.value);
}

export function evaluateConditions(
  ctx: ApprovalRuleContext,
  conditions: RuleConditions,
): boolean {
  const entries = Object.entries(conditions);
  if (entries.length === 0) return true;
  return entries.every(([field, condition]) =>
    evaluateCondition(getContextValue(ctx, field), condition),
  );
}

export function validateWorkflowDefinition(
  workflow: WorkflowDefinition,
): WorkflowStepDefinition[] {
  if (!workflow?.steps || !Array.isArray(workflow.steps) || workflow.steps.length === 0) {
    throw new Error("Workflow must include at least one step.");
  }
  const sorted = [...workflow.steps].sort((a, b) => a.stepNumber - b.stepNumber);
  for (const step of sorted) {
    if (!step.name?.trim()) throw new Error("Each workflow step requires a name.");
    if (!Number.isFinite(step.stepNumber) || step.stepNumber < 1) {
      throw new Error("Each workflow step requires a positive stepNumber.");
    }
  }
  return sorted;
}

export function defaultAdminWorkflow(): WorkflowDefinition {
  return {
    steps: [
      {
        stepNumber: 1,
        name: "Administrator Review",
        approverType: "PERMISSION",
        requiredPermission: "APPROVE_REQUEST",
        dueInHours: 48,
      },
    ],
  };
}

export async function matchApprovalRule(ctx: ApprovalRuleContext) {
  const rules = await prisma.approvalRule.findMany({
    where: {
      organizationId: ctx.organizationId,
      isActive: true,
      OR: [{ approvalType: ctx.approvalType }, { approvalType: "*" }],
    },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  });

  for (const rule of rules) {
    if (rule.sourceModule && ctx.sourceModule && rule.sourceModule !== ctx.sourceModule) {
      continue;
    }
    const conditions = parseJson<RuleConditions>(rule.conditionsJson, {});
    if (!evaluateConditions(ctx, conditions)) continue;
    const workflow = parseJson<WorkflowDefinition>(rule.workflowJson, {
      steps: [],
    });
    const steps = validateWorkflowDefinition(workflow);
    return { rule, steps };
  }

  return {
    rule: null,
    steps: validateWorkflowDefinition(defaultAdminWorkflow()),
  };
}

const SEED_RULES = [
  {
    name: "Parts Order over $2,000",
    description: "Service Manager then Executive for large parts orders.",
    approvalType: "PARTS_ORDER",
    sourceModule: "parts",
    priority: 10,
    conditions: {
      requestedAmount: { operator: "GREATER_THAN", value: 2000 },
    },
    workflow: {
      steps: [
        {
          stepNumber: 1,
          name: "Service Manager Review",
          requiredPermission: "APPROVE_REQUEST",
          dueInHours: 24,
        },
        {
          stepNumber: 2,
          name: "Executive Review",
          requiredPermission: "APPROVE_REQUEST",
          dueInHours: 48,
        },
      ],
    },
  },
  {
    name: "Expense over $500",
    description: "Finance review for expenses above $500.",
    approvalType: "EXPENSE_REQUEST",
    sourceModule: "finance",
    priority: 20,
    conditions: {
      requestedAmount: { operator: "GREATER_THAN", value: 500 },
    },
    workflow: {
      steps: [
        {
          stepNumber: 1,
          name: "Finance Review",
          requiredPermission: "APPROVE_REQUEST",
          dueInHours: 48,
        },
      ],
    },
  },
  {
    name: "Critical Emergency Request",
    description: "Immediate executive review for critical emergencies.",
    approvalType: "EMERGENCY_REQUEST",
    sourceModule: "operations",
    priority: 5,
    conditions: {
      priority: { operator: "EQUALS", value: "CRITICAL" },
    },
    workflow: {
      steps: [
        {
          stepNumber: 1,
          name: "Executive Review",
          requiredPermission: "APPROVE_REQUEST",
          dueInHours: 4,
        },
      ],
    },
  },
  {
    name: "Inventory Adjustment over 20%",
    description: "Inventory Manager then Administrator for large adjustments.",
    approvalType: "INVENTORY_ADJUSTMENT",
    sourceModule: "inventory",
    priority: 15,
    conditions: {
      inventoryAdjustmentPercentage: {
        operator: "GREATER_THAN",
        value: 20,
      },
    },
    workflow: {
      steps: [
        {
          stepNumber: 1,
          name: "Inventory Manager Review",
          requiredPermission: "APPROVE_REQUEST",
          dueInHours: 24,
        },
        {
          stepNumber: 2,
          name: "Administrator Review",
          requiredPermission: "APPROVE_REQUEST",
          dueInHours: 48,
        },
      ],
    },
  },
] as const;

/** Idempotent seed — never overwrites administrator-created rules. */
export async function ensureApprovalRulesSeeded(
  organizationId = DEFAULT_ORG_ID,
) {
  for (const seed of SEED_RULES) {
    const existing = await prisma.approvalRule.findFirst({
      where: {
        organizationId,
        name: seed.name,
        approvalType: seed.approvalType,
      },
    });
    if (existing) continue;
    await prisma.approvalRule.create({
      data: {
        organizationId,
        name: seed.name,
        description: seed.description,
        approvalType: seed.approvalType,
        sourceModule: seed.sourceModule,
        isActive: true,
        priority: seed.priority,
        conditionsJson: JSON.stringify(seed.conditions),
        workflowJson: JSON.stringify(seed.workflow),
        createdByUserId: "system",
      },
    });
  }
}

export async function listApprovalRules(organizationId: string) {
  await ensureApprovalRulesSeeded(organizationId);
  return prisma.approvalRule.findMany({
    where: { organizationId },
    orderBy: [{ priority: "asc" }, { name: "asc" }],
  });
}

export async function createApprovalRule(input: {
  organizationId: string;
  name: string;
  description?: string | null;
  approvalType: string;
  sourceModule?: string | null;
  priority?: number;
  conditions: RuleConditions;
  workflow: WorkflowDefinition;
  actorUserId: string;
}) {
  validateWorkflowDefinition(input.workflow);
  return prisma.approvalRule.create({
    data: {
      organizationId: input.organizationId,
      name: input.name.trim(),
      description: input.description ?? null,
      approvalType: input.approvalType,
      sourceModule: input.sourceModule ?? null,
      isActive: true,
      priority: input.priority ?? 100,
      conditionsJson: JSON.stringify(input.conditions ?? {}),
      workflowJson: JSON.stringify(input.workflow),
      createdByUserId: input.actorUserId,
      updatedByUserId: input.actorUserId,
    },
  });
}

export async function updateApprovalRule(input: {
  id: string;
  organizationId: string;
  name?: string;
  description?: string | null;
  approvalType?: string;
  sourceModule?: string | null;
  priority?: number;
  conditions?: RuleConditions;
  workflow?: WorkflowDefinition;
  actorUserId: string;
}) {
  const existing = await prisma.approvalRule.findFirst({
    where: { id: input.id, organizationId: input.organizationId },
  });
  if (!existing) throw new Error("Approval rule not found.");
  if (input.workflow) validateWorkflowDefinition(input.workflow);
  return prisma.approvalRule.update({
    where: { id: existing.id },
    data: {
      name: input.name?.trim() ?? undefined,
      description:
        input.description === undefined ? undefined : input.description,
      approvalType: input.approvalType ?? undefined,
      sourceModule:
        input.sourceModule === undefined ? undefined : input.sourceModule,
      priority: input.priority ?? undefined,
      conditionsJson: input.conditions
        ? JSON.stringify(input.conditions)
        : undefined,
      workflowJson: input.workflow
        ? JSON.stringify(input.workflow)
        : undefined,
      updatedByUserId: input.actorUserId,
    },
  });
}

export async function setApprovalRuleActive(input: {
  id: string;
  organizationId: string;
  isActive: boolean;
  actorUserId: string;
}) {
  const existing = await prisma.approvalRule.findFirst({
    where: { id: input.id, organizationId: input.organizationId },
  });
  if (!existing) throw new Error("Approval rule not found.");
  return prisma.approvalRule.update({
    where: { id: existing.id },
    data: {
      isActive: input.isActive,
      updatedByUserId: input.actorUserId,
    },
  });
}
