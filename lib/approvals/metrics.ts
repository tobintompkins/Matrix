/**
 * Patch 50A — Approval Center live metrics.
 */

import { prisma } from "@/lib/db/prisma";
import type { AdminActor } from "@/lib/admin/auth";
import { hasMatrixPermission } from "@/lib/auth/permissions";
import { formatWaitingDuration } from "./waiting";
import { ensureApprovalRulesSeeded } from "./rules";

function scopeWhere(actor: AdminActor) {
  const base: Record<string, unknown> = {
    organizationId: actor.organizationId,
    status: { not: "ARCHIVED" },
  };
  if (!hasMatrixPermission(actor.role, "VIEW_ALL_APPROVALS")) {
    base.OR = [
      { requesterUserId: actor.userId },
      { assignedApproverUserId: actor.userId },
    ];
  }
  return base;
}

export async function getApprovalMetrics(actor: AdminActor) {
  await ensureApprovalRulesSeeded(actor.organizationId);
  const where = scopeWhere(actor);
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const [
    awaitingMyReview,
    allPending,
    criticalRequests,
    overdue,
    approvedToday,
    rejectedToday,
    escalatedRequests,
    completedForAvg,
  ] = await Promise.all([
    prisma.approvalRequest.count({
      where: {
        ...where,
        assignedApproverUserId: actor.userId,
        status: { in: ["PENDING", "IN_REVIEW", "ESCALATED"] },
      },
    }),
    prisma.approvalRequest.count({
      where: {
        ...where,
        status: { in: ["PENDING", "IN_REVIEW", "ESCALATED"] },
      },
    }),
    prisma.approvalRequest.count({
      where: {
        ...where,
        priority: "CRITICAL",
        status: { in: ["PENDING", "IN_REVIEW", "ESCALATED", "DRAFT"] },
      },
    }),
    prisma.approvalRequest.count({
      where: {
        ...where,
        dueAt: { lt: now },
        status: { in: ["PENDING", "IN_REVIEW", "ESCALATED"] },
      },
    }),
    prisma.approvalRequest.count({
      where: {
        ...where,
        status: { in: ["APPROVED", "COMPLETED"] },
        completedAt: { gte: startOfDay },
      },
    }),
    prisma.approvalRequest.count({
      where: {
        ...where,
        status: "REJECTED",
        completedAt: { gte: startOfDay },
      },
    }),
    prisma.approvalRequest.count({
      where: { ...where, status: "ESCALATED" },
    }),
    prisma.approvalRequest.findMany({
      where: {
        ...where,
        status: { in: ["APPROVED", "COMPLETED", "REJECTED"] },
        submittedAt: { not: null },
        completedAt: { not: null },
      },
      select: { submittedAt: true, completedAt: true },
      take: 200,
      orderBy: { completedAt: "desc" },
    }),
  ]);

  let avgMs = 0;
  if (completedForAvg.length > 0) {
    const total = completedForAvg.reduce((sum, row) => {
      if (!row.submittedAt || !row.completedAt) return sum;
      return sum + (row.completedAt.getTime() - row.submittedAt.getTime());
    }, 0);
    avgMs = total / completedForAvg.length;
  }

  const recentDecisions = await prisma.approvalDecision.findMany({
    where: {
      request: { organizationId: actor.organizationId },
    },
    orderBy: { decidedAt: "desc" },
    take: 8,
    include: {
      request: {
        select: { requestNumber: true, title: true, organizationId: true },
      },
    },
  });

  return {
    cards: [
      {
        key: "awaitingMe",
        label: "Awaiting My Review",
        value: awaitingMyReview,
        href: "/admin/approvals?awaitingMe=1",
      },
      {
        key: "pending",
        label: "All Pending",
        value: allPending,
        href: "/admin/approvals?status=PENDING",
      },
      {
        key: "critical",
        label: "Critical Requests",
        value: criticalRequests,
        href: "/admin/approvals?priority=CRITICAL",
      },
      {
        key: "overdue",
        label: "Overdue",
        value: overdue,
        href: "/admin/approvals?overdueOnly=1",
      },
      {
        key: "approvedToday",
        label: "Approved Today",
        value: approvedToday,
        href: "/admin/approvals?status=COMPLETED",
      },
      {
        key: "rejectedToday",
        label: "Rejected Today",
        value: rejectedToday,
        href: "/admin/approvals?status=REJECTED",
      },
      {
        key: "avgTime",
        label: "Average Approval Time",
        value: completedForAvg.length
          ? formatWaitingDuration(avgMs)
          : "—",
        href: "/admin/approvals",
      },
      {
        key: "escalated",
        label: "Escalated Requests",
        value: escalatedRequests,
        href: "/admin/approvals?escalatedOnly=1",
      },
    ],
    recentDecisions: recentDecisions.map((d) => ({
      id: d.id,
      decision: d.decision,
      decidedAt: d.decidedAt,
      decidedByName: d.decidedByName,
      requestNumber: d.request.requestNumber,
      title: d.request.title,
      approvalRequestId: d.approvalRequestId,
    })),
  };
}
