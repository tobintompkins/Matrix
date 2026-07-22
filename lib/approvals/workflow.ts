/**
 * Patch 50A — Approval workflow engine.
 */

import { prisma } from "@/lib/db/prisma";
import { writeAdminAudit } from "@/lib/admin/repository";
import type { AdminActor } from "@/lib/admin/auth";
import { hasMatrixPermission } from "@/lib/auth/permissions";
import {
  canActOnStep,
  isClosedStatus,
  requirePermission,
  roleDisplay,
} from "./authorization";
import { matchApprovalRule } from "./rules";
import { generateDecisionSignature } from "./signature";
import { notifyApprovalEvent } from "./notifications";
import { assertNonEmpty, sanitizeCommentBody } from "./sanitize";
import type { WorkflowStepDefinition } from "./types";

async function loadRequest(id: string, organizationId: string) {
  const request = await prisma.approvalRequest.findFirst({
    where: { id, organizationId },
    include: {
      steps: { orderBy: { stepNumber: "asc" } },
      decisions: { orderBy: { decidedAt: "asc" } },
      assignments: { orderBy: { createdAt: "asc" } },
      comments: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
      },
      attachments: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!request) throw new Error("Approval request not found.");
  return request;
}

async function recordDecision(input: {
  approvalRequestId: string;
  approvalStepId: string | null;
  decision: string;
  actor: AdminActor;
  comment?: string | null;
  metadata?: Record<string, unknown>;
  organizationId: string;
}) {
  const decidedAt = new Date();
  const signatureHash = generateDecisionSignature({
    approvalRequestId: input.approvalRequestId,
    approvalStepId: input.approvalStepId,
    decision: input.decision,
    decidedByUserId: input.actor.userId,
    decidedByRoleName: roleDisplay(input.actor.role),
    decidedAtIso: decidedAt.toISOString(),
    organizationId: input.organizationId,
  });

  return prisma.approvalDecision.create({
    data: {
      approvalRequestId: input.approvalRequestId,
      approvalStepId: input.approvalStepId,
      decision: input.decision,
      decidedByUserId: input.actor.userId,
      decidedByName: input.actor.displayName,
      decidedByRoleName: roleDisplay(input.actor.role),
      comment: input.comment ?? null,
      signatureHash,
      decidedAt,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  });
}

function buildStepRows(
  requestId: string,
  steps: WorkflowStepDefinition[],
  submittedAt: Date,
) {
  return steps.map((step) => {
    const dueAt =
      step.dueInHours != null
        ? new Date(submittedAt.getTime() + step.dueInHours * 3600_000)
        : null;
    return {
      approvalRequestId: requestId,
      stepNumber: step.stepNumber,
      name: step.name,
      approverType: step.approverType ?? "PERMISSION",
      requiredRoleId: step.requiredRoleId ?? null,
      requiredPermission: step.requiredPermission ?? "APPROVE_REQUEST",
      assignedUserId: step.assignedUserId ?? null,
      status: step.stepNumber === steps[0]?.stepNumber ? "ACTIVE" : "WAITING",
      minimumApprovals: step.minimumApprovals ?? 1,
      approvalsReceived: 0,
      dueAt,
      optional: step.optional ?? false,
    };
  });
}

export async function buildWorkflowForRequest(input: {
  requestId: string;
  organizationId: string;
  actor: AdminActor;
  inventoryAdjustmentPercentage?: number | null;
}) {
  const request = await prisma.approvalRequest.findFirst({
    where: { id: input.requestId, organizationId: input.organizationId },
  });
  if (!request) throw new Error("Approval request not found.");

  const { rule, steps } = await matchApprovalRule({
    organizationId: input.organizationId,
    approvalType: request.approvalType,
    sourceModule: request.sourceModule,
    priority: request.priority,
    departmentId: request.requesterDepartmentId,
    requestedAmount: request.requestedAmount,
    currency: request.currency,
    emergencyFlag: request.approvalType === "EMERGENCY_REQUEST",
    inventoryAdjustmentPercentage: input.inventoryAdjustmentPercentage ?? null,
    requesterRole: input.actor.role,
    machineId: request.machineId,
    customerId: request.customerId,
    serviceCallId: request.serviceCallId,
  });

  const now = new Date();
  await prisma.approvalStep.deleteMany({
    where: { approvalRequestId: request.id },
  });
  await prisma.approvalStep.createMany({
    data: buildStepRows(request.id, steps, now),
  });

  const first = await prisma.approvalStep.findFirst({
    where: { approvalRequestId: request.id, stepNumber: steps[0].stepNumber },
  });

  const updated = await prisma.approvalRequest.update({
    where: { id: request.id },
    data: {
      status: "PENDING",
      currentStepNumber: steps[0].stepNumber,
      totalSteps: steps.length,
      selectedRuleId: rule?.id ?? null,
      submittedAt: now,
      assignedApproverUserId: first?.assignedUserId ?? null,
      dueAt: first?.dueAt ?? request.dueAt,
      version: { increment: 1 },
    },
  });

  if (first?.assignedUserId) {
    await prisma.approvalAssignment.create({
      data: {
        approvalRequestId: request.id,
        approvalStepId: first.id,
        assignedToUserId: first.assignedUserId,
        assignedToName: first.assignedUserName,
        assignedByUserId: input.actor.userId,
        assignedByName: input.actor.displayName,
        assignmentType: "DIRECT",
        reason: "Initial workflow assignment",
      },
    });
  }

  await writeAdminAudit({
    organizationId: input.organizationId,
    actorId: input.actor.userId,
    action: "APPROVAL_RULE_SELECTED",
    entityType: "ApprovalRequest",
    entityId: request.id,
    payload: {
      ruleId: rule?.id ?? null,
      ruleName: rule?.name ?? "Default Administrator Review",
      steps: steps.length,
    },
  });

  notifyApprovalEvent({
    type: "APPROVAL_SUBMITTED",
    title: `Approval submitted — ${updated.requestNumber}`,
    message: `${input.actor.displayName} submitted "${updated.title}" for review.`,
    userIds: [
      updated.requesterUserId,
      ...(updated.assignedApproverUserId
        ? [updated.assignedApproverUserId]
        : []),
    ],
    approvalRequestId: updated.id,
    priority: updated.priority === "CRITICAL" ? "URGENT" : "NORMAL",
  });

  if (updated.priority === "CRITICAL") {
    notifyApprovalEvent({
      type: "APPROVAL_CRITICAL",
      title: `Critical approval — ${updated.requestNumber}`,
      message: `Critical request "${updated.title}" requires immediate review.`,
      userIds: [updated.assignedApproverUserId ?? updated.requesterUserId],
      approvalRequestId: updated.id,
      priority: "URGENT",
    });
  }

  return loadRequest(updated.id, input.organizationId);
}

export async function approveRequest(input: {
  id: string;
  actor: AdminActor;
  comment?: string | null;
}) {
  requirePermission(input.actor, "APPROVE_REQUEST");

  return prisma.$transaction(async (tx) => {
    const request = await tx.approvalRequest.findFirst({
      where: { id: input.id, organizationId: input.actor.organizationId },
      include: { steps: { orderBy: { stepNumber: "asc" } } },
    });
    if (!request) throw new Error("Approval request not found.");
    if (isClosedStatus(request.status) || request.status === "DRAFT") {
      throw new Error("Request is not open for approval.");
    }

    const active = request.steps.find((s) => s.status === "ACTIVE");
    if (!active) throw new Error("No active approval step.");

    if (
      !canActOnStep(input.actor, {
        assignedUserId: active.assignedUserId,
        requiredPermission: active.requiredPermission,
        status: active.status,
      })
    ) {
      throw new Error("You are not eligible to approve this step.");
    }

    // Optimistic lock via version + active status check
    const lock = await tx.approvalRequest.updateMany({
      where: {
        id: request.id,
        version: request.version,
        status: { in: ["PENDING", "IN_REVIEW", "ESCALATED"] },
      },
      data: { version: { increment: 1 }, status: "IN_REVIEW" },
    });
    if (lock.count === 0) {
      throw new Error("Request was updated by another action. Retry.");
    }

    const decidedAt = new Date();
    const signatureHash = generateDecisionSignature({
      approvalRequestId: request.id,
      approvalStepId: active.id,
      decision: "APPROVED",
      decidedByUserId: input.actor.userId,
      decidedByRoleName: roleDisplay(input.actor.role),
      decidedAtIso: decidedAt.toISOString(),
      organizationId: input.actor.organizationId,
    });

    try {
      await tx.approvalDecision.create({
        data: {
          approvalRequestId: request.id,
          approvalStepId: active.id,
          decision: "APPROVED",
          decidedByUserId: input.actor.userId,
          decidedByName: input.actor.displayName,
          decidedByRoleName: roleDisplay(input.actor.role),
          comment: sanitizeCommentBody(input.comment ?? "") || null,
          signatureHash,
          decidedAt,
        },
      });
    } catch {
      throw new Error("Duplicate approval decision prevented.");
    }

    const approvalsReceived = active.approvalsReceived + 1;
    const stepComplete = approvalsReceived >= active.minimumApprovals;

    await tx.approvalStep.update({
      where: { id: active.id },
      data: {
        approvalsReceived,
        status: stepComplete ? "APPROVED" : "ACTIVE",
        completedAt: stepComplete ? decidedAt : null,
      },
    });

    let nextStatus = "IN_REVIEW";
    let nextStepNumber = request.currentStepNumber;
    let assignedApproverUserId = request.assignedApproverUserId;
    let completedAt: Date | null = null;

    if (stepComplete) {
      const next = request.steps.find(
        (s) => s.stepNumber > active.stepNumber && s.status === "WAITING",
      );
      if (next) {
        await tx.approvalStep.update({
          where: { id: next.id },
          data: { status: "ACTIVE" },
        });
        nextStepNumber = next.stepNumber;
        assignedApproverUserId = next.assignedUserId;
        nextStatus = "PENDING";
        if (next.assignedUserId) {
          await tx.approvalAssignment.create({
            data: {
              approvalRequestId: request.id,
              approvalStepId: next.id,
              assignedToUserId: next.assignedUserId,
              assignedByUserId: input.actor.userId,
              assignedByName: input.actor.displayName,
              assignmentType: "DIRECT",
              reason: "Advanced to next workflow step",
            },
          });
        }
      } else {
        nextStatus = "APPROVED";
        completedAt = decidedAt;
        assignedApproverUserId = null;
      }
    }

    const updated = await tx.approvalRequest.update({
      where: { id: request.id },
      data: {
        status: nextStatus === "APPROVED" ? "COMPLETED" : nextStatus,
        currentStepNumber: nextStepNumber,
        assignedApproverUserId,
        completedAt,
      },
    });

    await writeAdminAudit({
      organizationId: input.actor.organizationId,
      actorId: input.actor.userId,
      action:
        nextStatus === "APPROVED" || updated.status === "COMPLETED"
          ? "APPROVAL_COMPLETED"
          : "APPROVAL_APPROVED",
      entityType: "ApprovalRequest",
      entityId: request.id,
      payload: {
        previousStatus: request.status,
        newStatus: updated.status,
        stepNumber: active.stepNumber,
      },
    });

    notifyApprovalEvent({
      type: "APPROVAL_APPROVED",
      title: `Approval update — ${updated.requestNumber}`,
      message:
        updated.status === "COMPLETED"
          ? `"${updated.title}" was fully approved.`
          : `Step ${active.stepNumber} approved for "${updated.title}".`,
      userIds: [updated.requesterUserId, ...(assignedApproverUserId ? [assignedApproverUserId] : [])],
      approvalRequestId: updated.id,
    });

    return updated;
  });
}

export async function rejectRequest(input: {
  id: string;
  actor: AdminActor;
  reason: string;
}) {
  requirePermission(input.actor, "REJECT_REQUEST");
  const reason = sanitizeCommentBody(input.reason);
  assertNonEmpty(reason, "Rejection reason");

  return prisma.$transaction(async (tx) => {
    const request = await tx.approvalRequest.findFirst({
      where: { id: input.id, organizationId: input.actor.organizationId },
      include: { steps: true },
    });
    if (!request) throw new Error("Approval request not found.");
    if (isClosedStatus(request.status) || request.status === "DRAFT") {
      throw new Error("Request cannot be rejected in its current state.");
    }
    const active = request.steps.find((s) => s.status === "ACTIVE");
    if (
      active &&
      !canActOnStep(input.actor, {
        assignedUserId: active.assignedUserId,
        requiredPermission: active.requiredPermission,
        status: active.status,
      })
    ) {
      throw new Error("You are not eligible to reject this request.");
    }

    const lock = await tx.approvalRequest.updateMany({
      where: {
        id: request.id,
        version: request.version,
        status: { in: ["PENDING", "IN_REVIEW", "ESCALATED", "RETURNED_FOR_REVISION"] },
      },
      data: { version: { increment: 1 } },
    });
    if (lock.count === 0) throw new Error("Request was updated by another action. Retry.");

    const decidedAt = new Date();
    const signatureHash = generateDecisionSignature({
      approvalRequestId: request.id,
      approvalStepId: active?.id ?? null,
      decision: "REJECTED",
      decidedByUserId: input.actor.userId,
      decidedByRoleName: roleDisplay(input.actor.role),
      decidedAtIso: decidedAt.toISOString(),
      organizationId: input.actor.organizationId,
    });

    await tx.approvalDecision.create({
      data: {
        approvalRequestId: request.id,
        approvalStepId: active?.id ?? null,
        decision: "REJECTED",
        decidedByUserId: input.actor.userId,
        decidedByName: input.actor.displayName,
        decidedByRoleName: roleDisplay(input.actor.role),
        comment: reason,
        signatureHash,
        decidedAt,
      },
    });

    if (active) {
      await tx.approvalStep.update({
        where: { id: active.id },
        data: { status: "REJECTED", completedAt: decidedAt },
      });
    }

    const updated = await tx.approvalRequest.update({
      where: { id: request.id },
      data: {
        status: "REJECTED",
        completedAt: decidedAt,
        assignedApproverUserId: null,
      },
    });

    await writeAdminAudit({
      organizationId: input.actor.organizationId,
      actorId: input.actor.userId,
      action: "APPROVAL_REJECTED",
      entityType: "ApprovalRequest",
      entityId: request.id,
      payload: {
        previousStatus: request.status,
        newStatus: "REJECTED",
        reason,
      },
    });

    notifyApprovalEvent({
      type: "APPROVAL_REJECTED",
      title: `Approval rejected — ${updated.requestNumber}`,
      message: `"${updated.title}" was rejected. Reason: ${reason}`,
      userIds: [updated.requesterUserId],
      approvalRequestId: updated.id,
      priority: "HIGH",
    });

    return updated;
  });
}

export async function returnForRevision(input: {
  id: string;
  actor: AdminActor;
  instructions: string;
}) {
  requirePermission(input.actor, "RETURN_APPROVAL_FOR_REVISION");
  const instructions = sanitizeCommentBody(input.instructions);
  assertNonEmpty(instructions, "Revision instructions");

  return prisma.$transaction(async (tx) => {
    const request = await tx.approvalRequest.findFirst({
      where: { id: input.id, organizationId: input.actor.organizationId },
      include: { steps: true },
    });
    if (!request) throw new Error("Approval request not found.");
    if (isClosedStatus(request.status) || request.status === "DRAFT") {
      throw new Error("Request cannot be returned in its current state.");
    }
    const active = request.steps.find((s) => s.status === "ACTIVE");

    const decidedAt = new Date();
    const signatureHash = generateDecisionSignature({
      approvalRequestId: request.id,
      approvalStepId: active?.id ?? null,
      decision: "RETURNED",
      decidedByUserId: input.actor.userId,
      decidedByRoleName: roleDisplay(input.actor.role),
      decidedAtIso: decidedAt.toISOString(),
      organizationId: input.actor.organizationId,
    });

    await tx.approvalDecision.create({
      data: {
        approvalRequestId: request.id,
        approvalStepId: active?.id ?? null,
        decision: "RETURNED",
        decidedByUserId: input.actor.userId,
        decidedByName: input.actor.displayName,
        decidedByRoleName: roleDisplay(input.actor.role),
        comment: instructions,
        signatureHash,
        decidedAt,
      },
    });

    const updated = await tx.approvalRequest.update({
      where: { id: request.id },
      data: {
        status: "RETURNED_FOR_REVISION",
        version: { increment: 1 },
      },
    });

    await writeAdminAudit({
      organizationId: input.actor.organizationId,
      actorId: input.actor.userId,
      action: "APPROVAL_RETURNED",
      entityType: "ApprovalRequest",
      entityId: request.id,
      payload: { instructions, previousStatus: request.status },
    });

    notifyApprovalEvent({
      type: "APPROVAL_RETURNED",
      title: `Returned for revision — ${updated.requestNumber}`,
      message: instructions,
      userIds: [updated.requesterUserId],
      approvalRequestId: updated.id,
      priority: "HIGH",
    });

    return updated;
  });
}

export async function escalateRequest(input: {
  id: string;
  actor: AdminActor;
  reason: string;
  escalateToUserId: string;
  escalateToName?: string | null;
}) {
  requirePermission(input.actor, "ESCALATE_APPROVAL");
  const reason = sanitizeCommentBody(input.reason);
  assertNonEmpty(reason, "Escalation reason");

  if (!input.escalateToUserId.trim()) {
    throw new Error("Escalation reviewer is required.");
  }

  return prisma.$transaction(async (tx) => {
    const request = await tx.approvalRequest.findFirst({
      where: { id: input.id, organizationId: input.actor.organizationId },
      include: { steps: true },
    });
    if (!request) throw new Error("Approval request not found.");
    if (isClosedStatus(request.status)) {
      throw new Error("Closed requests cannot be escalated.");
    }
    const active = request.steps.find((s) => s.status === "ACTIVE");
    const now = new Date();

    const signatureHash = generateDecisionSignature({
      approvalRequestId: request.id,
      approvalStepId: active?.id ?? null,
      decision: "ESCALATED",
      decidedByUserId: input.actor.userId,
      decidedByRoleName: roleDisplay(input.actor.role),
      decidedAtIso: now.toISOString(),
      organizationId: input.actor.organizationId,
    });

    await tx.approvalDecision.create({
      data: {
        approvalRequestId: request.id,
        approvalStepId: active?.id ?? null,
        decision: "ESCALATED",
        decidedByUserId: input.actor.userId,
        decidedByName: input.actor.displayName,
        decidedByRoleName: roleDisplay(input.actor.role),
        comment: reason,
        signatureHash,
        decidedAt: now,
      },
    });

    if (active) {
      await tx.approvalStep.update({
        where: { id: active.id },
        data: {
          assignedUserId: input.escalateToUserId,
          assignedUserName: input.escalateToName ?? null,
        },
      });
    }

    await tx.approvalAssignment.create({
      data: {
        approvalRequestId: request.id,
        approvalStepId: active?.id ?? null,
        assignedToUserId: input.escalateToUserId,
        assignedToName: input.escalateToName ?? null,
        assignedByUserId: input.actor.userId,
        assignedByName: input.actor.displayName,
        assignmentType: "ESCALATED",
        reason,
      },
    });

    const updated = await tx.approvalRequest.update({
      where: { id: request.id },
      data: {
        status: "ESCALATED",
        escalatedAt: now,
        assignedApproverUserId: input.escalateToUserId,
        assignedApproverName: input.escalateToName ?? null,
        version: { increment: 1 },
      },
    });

    await writeAdminAudit({
      organizationId: input.actor.organizationId,
      actorId: input.actor.userId,
      action: "APPROVAL_ESCALATED",
      entityType: "ApprovalRequest",
      entityId: request.id,
      payload: { reason, escalateToUserId: input.escalateToUserId },
    });

    notifyApprovalEvent({
      type: "APPROVAL_ESCALATED",
      title: `Escalated — ${updated.requestNumber}`,
      message: reason,
      userIds: [input.escalateToUserId, updated.requesterUserId],
      approvalRequestId: updated.id,
      priority: "URGENT",
    });

    return updated;
  });
}

export async function assignReviewer(input: {
  id: string;
  actor: AdminActor;
  assigneeUserId: string;
  assigneeName?: string | null;
  reason?: string | null;
}) {
  requirePermission(input.actor, "ASSIGN_APPROVAL_REVIEWER");
  if (!hasMatrixPermission(input.actor.role, "APPROVE_REQUEST") &&
      !input.assigneeUserId) {
    throw new Error("Assignee required.");
  }

  return prisma.$transaction(async (tx) => {
    const request = await tx.approvalRequest.findFirst({
      where: { id: input.id, organizationId: input.actor.organizationId },
      include: { steps: true },
    });
    if (!request) throw new Error("Approval request not found.");
    if (isClosedStatus(request.status)) {
      throw new Error("Cannot assign a closed request.");
    }
    const active = request.steps.find((s) => s.status === "ACTIVE");
    const reason =
      sanitizeCommentBody(input.reason ?? "") ||
      (request.assignedApproverUserId
        ? "Reviewer reassigned"
        : "Reviewer assigned");

    if (active) {
      await tx.approvalStep.update({
        where: { id: active.id },
        data: {
          assignedUserId: input.assigneeUserId,
          assignedUserName: input.assigneeName ?? null,
        },
      });
    }

    await tx.approvalAssignment.create({
      data: {
        approvalRequestId: request.id,
        approvalStepId: active?.id ?? null,
        assignedToUserId: input.assigneeUserId,
        assignedToName: input.assigneeName ?? null,
        assignedByUserId: input.actor.userId,
        assignedByName: input.actor.displayName,
        assignmentType: request.assignedApproverUserId
          ? "REASSIGNED"
          : "DIRECT",
        reason,
      },
    });

    const updated = await tx.approvalRequest.update({
      where: { id: request.id },
      data: {
        assignedApproverUserId: input.assigneeUserId,
        assignedApproverName: input.assigneeName ?? null,
        version: { increment: 1 },
      },
    });

    await writeAdminAudit({
      organizationId: input.actor.organizationId,
      actorId: input.actor.userId,
      action: request.assignedApproverUserId
        ? "APPROVAL_REASSIGNED"
        : "APPROVAL_ASSIGNED",
      entityType: "ApprovalRequest",
      entityId: request.id,
      payload: { assigneeUserId: input.assigneeUserId, reason },
    });

    notifyApprovalEvent({
      type: "APPROVAL_ASSIGNED",
      title: `Assigned — ${updated.requestNumber}`,
      message: `You were assigned to review "${updated.title}".`,
      userIds: [input.assigneeUserId],
      approvalRequestId: updated.id,
    });

    return updated;
  });
}

export async function delegateReview(input: {
  id: string;
  actor: AdminActor;
  delegateUserId: string;
  delegateName?: string | null;
  reason?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
}) {
  requirePermission(input.actor, "DELEGATE_APPROVAL");
  const reason = sanitizeCommentBody(input.reason ?? "") || "Delegated review";

  return prisma.$transaction(async (tx) => {
    const request = await tx.approvalRequest.findFirst({
      where: { id: input.id, organizationId: input.actor.organizationId },
      include: { steps: true },
    });
    if (!request) throw new Error("Approval request not found.");
    if (isClosedStatus(request.status)) {
      throw new Error("Cannot delegate a closed request.");
    }

    const isCurrentApprover =
      request.assignedApproverUserId === input.actor.userId;
    if (
      !isCurrentApprover &&
      !hasMatrixPermission(input.actor.role, "ASSIGN_APPROVAL_REVIEWER")
    ) {
      throw new Error("Only the current approver or an assigner can delegate.");
    }

    const active = request.steps.find((s) => s.status === "ACTIVE");
    const now = new Date();
    const signatureHash = generateDecisionSignature({
      approvalRequestId: request.id,
      approvalStepId: active?.id ?? null,
      decision: "DELEGATED",
      decidedByUserId: input.actor.userId,
      decidedByRoleName: roleDisplay(input.actor.role),
      decidedAtIso: now.toISOString(),
      organizationId: input.actor.organizationId,
    });

    await tx.approvalDecision.create({
      data: {
        approvalRequestId: request.id,
        approvalStepId: active?.id ?? null,
        decision: "DELEGATED",
        decidedByUserId: input.actor.userId,
        decidedByName: input.actor.displayName,
        decidedByRoleName: roleDisplay(input.actor.role),
        comment: reason,
        signatureHash,
        decidedAt: now,
      },
    });

    if (active) {
      await tx.approvalStep.update({
        where: { id: active.id },
        data: {
          assignedUserId: input.delegateUserId,
          assignedUserName: input.delegateName ?? null,
        },
      });
    }

    await tx.approvalAssignment.create({
      data: {
        approvalRequestId: request.id,
        approvalStepId: active?.id ?? null,
        assignedToUserId: input.delegateUserId,
        assignedToName: input.delegateName ?? null,
        assignedByUserId: input.actor.userId,
        assignedByName: input.actor.displayName,
        assignmentType: "DELEGATED",
        reason,
        startsAt: input.startsAt ? new Date(input.startsAt) : now,
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
      },
    });

    const updated = await tx.approvalRequest.update({
      where: { id: request.id },
      data: {
        assignedApproverUserId: input.delegateUserId,
        assignedApproverName: input.delegateName ?? null,
        version: { increment: 1 },
      },
    });

    await writeAdminAudit({
      organizationId: input.actor.organizationId,
      actorId: input.actor.userId,
      action: "APPROVAL_DELEGATED",
      entityType: "ApprovalRequest",
      entityId: request.id,
      payload: { delegateUserId: input.delegateUserId, reason },
    });

    notifyApprovalEvent({
      type: "APPROVAL_DELEGATED",
      title: `Delegated — ${updated.requestNumber}`,
      message: `Review of "${updated.title}" was delegated to you.`,
      userIds: [input.delegateUserId, updated.requesterUserId],
      approvalRequestId: updated.id,
    });

    return updated;
  });
}

export { loadRequest, recordDecision };
