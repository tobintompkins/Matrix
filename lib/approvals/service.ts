/**
 * Patch 50A — ApprovalService (create, update draft, submit, list, cancel, archive, comments).
 */

import { prisma } from "@/lib/db/prisma";
import { writeAdminAudit } from "@/lib/admin/repository";
import type { AdminActor } from "@/lib/admin/auth";
import { hasMatrixPermission } from "@/lib/auth/permissions";
import {
  canViewApproval,
  isClosedStatus,
  requirePermission,
  roleDisplay,
} from "./authorization";
import { nextApprovalRequestNumber } from "./numbering";
import { ensureApprovalRulesSeeded } from "./rules";
import { buildWorkflowForRequest, loadRequest } from "./workflow";
import { notifyApprovalEvent } from "./notifications";
import {
  assertNonEmpty,
  sanitizeCommentBody,
  sanitizePlainText,
  sanitizeTitle,
} from "./sanitize";
import { formatWaitingDuration, isOverdue, classifySla } from "./waiting";
import { isKnownApprovalType } from "./registry";
import type {
  CreateApprovalInput,
  ListApprovalsFilter,
  UpdateDraftInput,
} from "./types";
import { generateDecisionSignature } from "./signature";

export async function createApprovalRequest(
  actor: AdminActor,
  input: CreateApprovalInput,
) {
  requirePermission(actor, "CREATE_APPROVAL_REQUEST");
  const title = sanitizeTitle(input.title);
  assertNonEmpty(title, "Title");
  if (!input.approvalType || !isKnownApprovalType(input.approvalType)) {
    // Allow known registry types; still accept extensible custom types that look safe
    if (!/^[A-Z][A-Z0-9_]{1,63}$/.test(input.approvalType ?? "")) {
      throw new Error("Invalid approval type.");
    }
  }

  await ensureApprovalRulesSeeded(actor.organizationId);
  const requestNumber = await nextApprovalRequestNumber(actor.organizationId);

  const created = await prisma.approvalRequest.create({
    data: {
      organizationId: actor.organizationId,
      requestNumber,
      title,
      description: sanitizePlainText(input.description ?? "") || null,
      businessJustification:
        sanitizePlainText(input.businessJustification ?? "") || null,
      approvalType: input.approvalType,
      sourceModule: input.sourceModule ?? null,
      sourceRecordId: input.sourceRecordId ?? null,
      status: "DRAFT",
      priority: input.priority ?? "NORMAL",
      requesterUserId: actor.userId,
      requesterName: actor.displayName,
      requesterDepartmentId: input.requesterDepartmentId ?? null,
      requestedAmount: input.requestedAmount ?? null,
      currency: input.currency ?? "USD",
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      customerId: input.customerId ?? null,
      machineId: input.machineId ?? null,
      serviceCallId: input.serviceCallId ?? null,
      partsOrderId: input.partsOrderId ?? null,
    },
  });

  await writeAdminAudit({
    organizationId: actor.organizationId,
    actorId: actor.userId,
    action: "APPROVAL_DRAFT_CREATED",
    entityType: "ApprovalRequest",
    entityId: created.id,
    payload: {
      requestNumber: created.requestNumber,
      approvalType: created.approvalType,
    },
  });

  if (input.submit) {
    return submitApprovalRequest(actor, created.id);
  }
  return created;
}

/**
 * Module integration entrypoint — other Matrix modules should call this
 * instead of writing ApprovalRequest rows directly.
 */
export async function submitApprovalFromModule(
  actor: AdminActor,
  input: CreateApprovalInput & {
    inventoryAdjustmentPercentage?: number | null;
  },
) {
  const created = await createApprovalRequest(actor, {
    ...input,
    submit: false,
  });
  return submitApprovalRequest(actor, created.id, {
    inventoryAdjustmentPercentage: input.inventoryAdjustmentPercentage,
  });
}

export async function updateDraft(
  actor: AdminActor,
  input: UpdateDraftInput,
) {
  const existing = await prisma.approvalRequest.findFirst({
    where: { id: input.id, organizationId: actor.organizationId },
  });
  if (!existing) throw new Error("Approval request not found.");
  if (
    existing.status !== "DRAFT" &&
    existing.status !== "RETURNED_FOR_REVISION"
  ) {
    throw new Error("Only drafts or returned requests can be edited.");
  }
  if (
    existing.requesterUserId !== actor.userId &&
    !hasMatrixPermission(actor.role, "VIEW_ALL_APPROVALS")
  ) {
    throw new Error("You cannot edit this request.");
  }

  const updated = await prisma.approvalRequest.update({
    where: { id: existing.id },
    data: {
      title: input.title !== undefined ? sanitizeTitle(input.title) : undefined,
      description:
        input.description !== undefined
          ? sanitizePlainText(input.description) || null
          : undefined,
      businessJustification:
        input.businessJustification !== undefined
          ? sanitizePlainText(input.businessJustification) || null
          : undefined,
      approvalType: input.approvalType,
      sourceModule: input.sourceModule,
      sourceRecordId: input.sourceRecordId,
      priority: input.priority,
      requesterDepartmentId: input.requesterDepartmentId,
      requestedAmount: input.requestedAmount,
      currency: input.currency,
      dueAt:
        input.dueAt === undefined
          ? undefined
          : input.dueAt
            ? new Date(input.dueAt)
            : null,
      customerId: input.customerId,
      machineId: input.machineId,
      serviceCallId: input.serviceCallId,
      partsOrderId: input.partsOrderId,
      version: { increment: 1 },
    },
  });

  await writeAdminAudit({
    organizationId: actor.organizationId,
    actorId: actor.userId,
    action: "APPROVAL_UPDATED",
    entityType: "ApprovalRequest",
    entityId: updated.id,
    payload: { status: updated.status },
  });

  return updated;
}

export async function submitApprovalRequest(
  actor: AdminActor,
  id: string,
  opts?: { inventoryAdjustmentPercentage?: number | null },
) {
  const existing = await prisma.approvalRequest.findFirst({
    where: { id, organizationId: actor.organizationId },
  });
  if (!existing) throw new Error("Approval request not found.");
  if (
    existing.status !== "DRAFT" &&
    existing.status !== "RETURNED_FOR_REVISION"
  ) {
    throw new Error("Only drafts or returned requests can be submitted.");
  }
  if (
    existing.requesterUserId !== actor.userId &&
    !hasMatrixPermission(actor.role, "VIEW_ALL_APPROVALS")
  ) {
    throw new Error("You cannot submit this request.");
  }
  assertNonEmpty(existing.title, "Title");

  const wasReturned = existing.status === "RETURNED_FOR_REVISION";
  const result = await buildWorkflowForRequest({
    requestId: existing.id,
    organizationId: actor.organizationId,
    actor,
    inventoryAdjustmentPercentage: opts?.inventoryAdjustmentPercentage,
  });

  await writeAdminAudit({
    organizationId: actor.organizationId,
    actorId: actor.userId,
    action: wasReturned ? "APPROVAL_RESUBMITTED" : "APPROVAL_SUBMITTED",
    entityType: "ApprovalRequest",
    entityId: existing.id,
    payload: {
      previousStatus: existing.status,
      newStatus: result.status,
    },
  });

  if (wasReturned) {
    notifyApprovalEvent({
      type: "APPROVAL_RESUBMITTED",
      title: `Resubmitted — ${result.requestNumber}`,
      message: `"${result.title}" was resubmitted for approval.`,
      userIds: [
        result.requesterUserId,
        ...(result.assignedApproverUserId
          ? [result.assignedApproverUserId]
          : []),
      ],
      approvalRequestId: result.id,
    });
  }

  return result;
}

export async function cancelApprovalRequest(
  actor: AdminActor,
  id: string,
  reason: string,
) {
  requirePermission(actor, "CANCEL_APPROVAL");
  const cleaned = sanitizeCommentBody(reason);
  assertNonEmpty(cleaned, "Cancellation reason");

  const existing = await prisma.approvalRequest.findFirst({
    where: { id, organizationId: actor.organizationId },
    include: { steps: true },
  });
  if (!existing) throw new Error("Approval request not found.");
  if (isClosedStatus(existing.status) && existing.status !== "CANCELLED") {
    throw new Error("Completed requests cannot be cancelled.");
  }
  if (
    existing.requesterUserId !== actor.userId &&
    !hasMatrixPermission(actor.role, "VIEW_ALL_APPROVALS")
  ) {
    throw new Error("You cannot cancel this request.");
  }

  const now = new Date();
  const signatureHash = generateDecisionSignature({
    approvalRequestId: existing.id,
    approvalStepId: existing.steps.find((s) => s.status === "ACTIVE")?.id ?? null,
    decision: "CANCELLED",
    decidedByUserId: actor.userId,
    decidedByRoleName: roleDisplay(actor.role),
    decidedAtIso: now.toISOString(),
    organizationId: actor.organizationId,
  });

  await prisma.approvalDecision.create({
    data: {
      approvalRequestId: existing.id,
      approvalStepId:
        existing.steps.find((s) => s.status === "ACTIVE")?.id ?? null,
      decision: "CANCELLED",
      decidedByUserId: actor.userId,
      decidedByName: actor.displayName,
      decidedByRoleName: roleDisplay(actor.role),
      comment: cleaned,
      signatureHash,
      decidedAt: now,
    },
  });

  await prisma.approvalStep.updateMany({
    where: {
      approvalRequestId: existing.id,
      status: { in: ["ACTIVE", "WAITING"] },
    },
    data: { status: "CANCELLED", completedAt: now },
  });

  const updated = await prisma.approvalRequest.update({
    where: { id: existing.id },
    data: {
      status: "CANCELLED",
      cancelledAt: now,
      completedAt: now,
      assignedApproverUserId: null,
      version: { increment: 1 },
    },
  });

  await writeAdminAudit({
    organizationId: actor.organizationId,
    actorId: actor.userId,
    action: "APPROVAL_CANCELLED",
    entityType: "ApprovalRequest",
    entityId: existing.id,
    payload: { reason: cleaned },
  });

  notifyApprovalEvent({
    type: "APPROVAL_CANCELLED",
    title: `Cancelled — ${updated.requestNumber}`,
    message: cleaned,
    userIds: [
      updated.requesterUserId,
      ...(existing.assignedApproverUserId
        ? [existing.assignedApproverUserId]
        : []),
    ],
    approvalRequestId: updated.id,
  });

  return updated;
}

export async function archiveApprovalRequest(actor: AdminActor, id: string) {
  requirePermission(actor, "ARCHIVE_APPROVALS");
  const existing = await prisma.approvalRequest.findFirst({
    where: { id, organizationId: actor.organizationId },
  });
  if (!existing) throw new Error("Approval request not found.");
  if (
    !["APPROVED", "REJECTED", "CANCELLED", "COMPLETED"].includes(
      existing.status,
    )
  ) {
    throw new Error("Only closed requests can be archived.");
  }

  const updated = await prisma.approvalRequest.update({
    where: { id: existing.id },
    data: {
      status: "ARCHIVED",
      archivedAt: new Date(),
      version: { increment: 1 },
    },
  });

  await writeAdminAudit({
    organizationId: actor.organizationId,
    actorId: actor.userId,
    action: "APPROVAL_ARCHIVED",
    entityType: "ApprovalRequest",
    entityId: existing.id,
    payload: { previousStatus: existing.status },
  });

  return updated;
}

export async function getApprovalRequest(actor: AdminActor, id: string) {
  requirePermission(actor, "VIEW_APPROVAL_CENTER");
  const request = await loadRequest(id, actor.organizationId);
  if (
    !canViewApproval(actor, {
      organizationId: request.organizationId,
      requesterUserId: request.requesterUserId,
      assignedApproverUserId: request.assignedApproverUserId,
      status: request.status,
    })
  ) {
    throw new Error("You do not have access to this approval request.");
  }

  const waitingSince = request.submittedAt ?? request.createdAt;
  const waitingMs = Date.now() - new Date(waitingSince).getTime();
  return {
    ...request,
    waitingTime: formatWaitingDuration(waitingMs),
    sla: classifySla({
      dueAt: request.dueAt,
      waitingSince,
    }),
    overdue: isOverdue(request.dueAt),
  };
}

export async function listApprovalRequests(filter: ListApprovalsFilter) {
  await ensureApprovalRulesSeeded(filter.organizationId);
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, filter.pageSize ?? 20));

  const where: Record<string, unknown> = {
    organizationId: filter.organizationId,
  };

  if (!filter.canViewAll) {
    where.OR = [
      { requesterUserId: filter.actorUserId },
      { assignedApproverUserId: filter.actorUserId },
    ];
  }

  if (filter.status) where.status = filter.status;
  else if (!filter.archived) {
    where.status = { not: "ARCHIVED" };
  }
  if (filter.archived) where.status = "ARCHIVED";
  if (filter.priority) where.priority = filter.priority;
  if (filter.approvalType) where.approvalType = filter.approvalType;
  if (filter.departmentId) where.requesterDepartmentId = filter.departmentId;
  if (filter.requesterUserId) where.requesterUserId = filter.requesterUserId;
  if (filter.assignedApproverUserId) {
    where.assignedApproverUserId = filter.assignedApproverUserId;
  }
  if (filter.awaitingMe) where.assignedApproverUserId = filter.actorUserId;
  if (filter.myRequests) where.requesterUserId = filter.actorUserId;
  if (filter.escalatedOnly) where.status = "ESCALATED";
  if (filter.overdueOnly) {
    where.dueAt = { lt: new Date() };
    where.status = { in: ["PENDING", "IN_REVIEW", "ESCALATED"] };
  }
  if (filter.submittedFrom || filter.submittedTo) {
    where.submittedAt = {
      ...(filter.submittedFrom
        ? { gte: new Date(filter.submittedFrom) }
        : {}),
      ...(filter.submittedTo ? { lte: new Date(filter.submittedTo) } : {}),
    };
  }
  if (filter.dueFrom || filter.dueTo) {
    where.dueAt = {
      ...(filter.dueFrom ? { gte: new Date(filter.dueFrom) } : {}),
      ...(filter.dueTo ? { lte: new Date(filter.dueTo) } : {}),
    };
  }
  if (filter.q?.trim()) {
    const q = filter.q.trim();
    const searchOr = [
      { requestNumber: { contains: q } },
      { title: { contains: q } },
      { requesterName: { contains: q } },
      { description: { contains: q } },
      { sourceRecordId: { contains: q } },
    ];
    if (where.OR) {
      where.AND = [{ OR: where.OR }, { OR: searchOr }];
      delete where.OR;
    } else {
      where.OR = searchOr;
    }
  }

  const sortBy = filter.sortBy ?? "submittedAt";
  const sortDir = filter.sortDir === "asc" ? ("asc" as const) : ("desc" as const);
  const orderBy: Record<string, "asc" | "desc"> =
    sortBy === "dueAt"
      ? { dueAt: sortDir }
      : sortBy === "priority"
        ? { priority: sortDir }
        : sortBy === "status"
          ? { status: sortDir }
          : sortBy === "requestNumber"
            ? { requestNumber: sortDir }
            : { submittedAt: sortDir };

  const [total, items] = await Promise.all([
    prisma.approvalRequest.count({ where }),
    prisma.approvalRequest.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const now = Date.now();
  return {
    total,
    page,
    pageSize,
    items: items.map((item) => {
      const waitingSince = item.submittedAt ?? item.createdAt;
      return {
        ...item,
        waitingTime: formatWaitingDuration(now - new Date(waitingSince).getTime()),
        sla: classifySla({ dueAt: item.dueAt, waitingSince }),
        overdue: isOverdue(item.dueAt),
      };
    }),
  };
}

export async function addApprovalComment(input: {
  actor: AdminActor;
  approvalRequestId: string;
  body: string;
  parentCommentId?: string | null;
  isInternal?: boolean;
}) {
  requirePermission(input.actor, "COMMENT_ON_APPROVAL");
  const body = sanitizeCommentBody(input.body);
  assertNonEmpty(body, "Comment");

  const request = await prisma.approvalRequest.findFirst({
    where: {
      id: input.approvalRequestId,
      organizationId: input.actor.organizationId,
    },
  });
  if (!request) throw new Error("Approval request not found.");
  if (
    !canViewApproval(input.actor, {
      organizationId: request.organizationId,
      requesterUserId: request.requesterUserId,
      assignedApproverUserId: request.assignedApproverUserId,
      status: request.status,
    })
  ) {
    throw new Error("You cannot comment on this request.");
  }

  if (input.parentCommentId) {
    const parent = await prisma.approvalComment.findFirst({
      where: {
        id: input.parentCommentId,
        approvalRequestId: request.id,
      },
    });
    if (!parent) throw new Error("Parent comment not found.");
  }

  const comment = await prisma.approvalComment.create({
    data: {
      approvalRequestId: request.id,
      parentCommentId: input.parentCommentId ?? null,
      authorUserId: input.actor.userId,
      authorName: input.actor.displayName,
      authorRole: roleDisplay(input.actor.role),
      body,
      isInternal: Boolean(input.isInternal),
    },
  });

  await writeAdminAudit({
    organizationId: input.actor.organizationId,
    actorId: input.actor.userId,
    action: "APPROVAL_COMMENTED",
    entityType: "ApprovalRequest",
    entityId: request.id,
    payload: { commentId: comment.id, isInternal: comment.isInternal },
  });

  notifyApprovalEvent({
    type: "APPROVAL_COMMENTED",
    title: `Comment — ${request.requestNumber}`,
    message: `${input.actor.displayName} commented on "${request.title}".`,
    userIds: [
      request.requesterUserId,
      ...(request.assignedApproverUserId
        ? [request.assignedApproverUserId]
        : []),
    ].filter((id) => id !== input.actor.userId),
    approvalRequestId: request.id,
  });

  return comment;
}

export async function listApprovalComments(
  actor: AdminActor,
  approvalRequestId: string,
) {
  requirePermission(actor, "VIEW_APPROVAL_CENTER");
  const request = await prisma.approvalRequest.findFirst({
    where: { id: approvalRequestId, organizationId: actor.organizationId },
  });
  if (!request) throw new Error("Approval request not found.");
  if (
    !canViewApproval(actor, {
      organizationId: request.organizationId,
      requesterUserId: request.requesterUserId,
      assignedApproverUserId: request.assignedApproverUserId,
      status: request.status,
    })
  ) {
    throw new Error("You cannot view comments for this request.");
  }

  const comments = await prisma.approvalComment.findMany({
    where: { approvalRequestId, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });

  const canSeeInternal = hasMatrixPermission(actor.role, "VIEW_ALL_APPROVALS");
  return comments.filter((c) => canSeeInternal || !c.isInternal);
}

export function approvalsToCsv(
  rows: Array<Record<string, unknown>>,
): string {
  const headers = [
    "requestNumber",
    "title",
    "approvalType",
    "status",
    "priority",
    "requesterName",
    "assignedApproverName",
    "requestedAmount",
    "currency",
    "submittedAt",
    "dueAt",
  ];
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(","));
  }
  return lines.join("\n");
}
