/**
 * Patch 51A.4 — Human workflow transitions (approve / reject / defer / assign / complete).
 * High-impact actions never auto-execute operational mutations.
 */

import { prisma } from "@/lib/db/prisma";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import { writeAdminAudit } from "@/lib/admin/repository";
import { assertDecisionTransition } from "./transitions";
import { writeDecisionHistory } from "./settings";
import { notifyDecisionEvent } from "./notify";
import type { DecisionStatus } from "./types";

type Actor = {
  userId: string;
  displayName: string;
};

async function loadDecision(id: string, organizationId = DEFAULT_ORG_ID) {
  return prisma.decisionRecommendation.findFirst({
    where: { id, organizationId },
  });
}

async function applyStatus(input: {
  decisionId: string;
  from: DecisionStatus;
  to: DecisionStatus;
  actor: Actor;
  action: string;
  reason?: string | null;
  notes?: string | null;
  patch?: Record<string, unknown>;
  organizationId?: string;
}) {
  const check = assertDecisionTransition(input.from, input.to);
  if (!check.ok) return { ok: false as const, error: check.error };

  const organizationId = input.organizationId ?? DEFAULT_ORG_ID;
  const updated = await prisma.decisionRecommendation.update({
    where: { id: input.decisionId },
    data: {
      status: input.to,
      ...(input.patch ?? {}),
    },
  });

  await writeDecisionHistory({
    organizationId,
    decisionId: input.decisionId,
    action: input.action,
    fromStatus: input.from,
    toStatus: input.to,
    actorUserId: input.actor.userId,
    actorName: input.actor.displayName,
    reason: input.reason,
    notes: input.notes,
  });

  try {
    await writeAdminAudit({
      organizationId,
      actorId: input.actor.userId,
      action: `DECISION_${input.action}`,
      entityType: "DecisionRecommendation",
      entityId: input.decisionId,
      message: `${input.action}: ${updated.title}`,
      payload: {
        fromStatus: input.from,
        toStatus: input.to,
        actorName: input.actor.displayName,
      },
      category: "AI_OPERATIONS",
      severity: "INFO",
      outcome: "SUCCESS",
    });
  } catch {
    /* best-effort */
  }

  return { ok: true as const, decision: updated };
}

export async function approveDecision(input: {
  decisionId: string;
  actor: Actor;
  notes?: string | null;
}) {
  const row = await loadDecision(input.decisionId);
  if (!row) return { ok: false as const, error: "Decision not found." };
  if (row.highImpact) {
    // Approval records intent only — does not mutate inventory/PM/service/customer.
  }
  const result = await applyStatus({
    decisionId: row.id,
    from: row.status as DecisionStatus,
    to: "APPROVED",
    actor: input.actor,
    action: "APPROVED",
    notes:
      input.notes ??
      (row.highImpact
        ? "Approved for human follow-through. High-impact operational changes were not auto-executed."
        : "Approved."),
    patch: {
      approvedAt: new Date(),
      approvedBy: input.actor.userId,
      reviewedAt: new Date(),
      reviewedBy: input.actor.userId,
    },
  });
  return result;
}

export async function rejectDecision(input: {
  decisionId: string;
  actor: Actor;
  reason: string;
}) {
  if (!input.reason.trim()) {
    return { ok: false as const, error: "Rejection requires a reason." };
  }
  const row = await loadDecision(input.decisionId);
  if (!row) return { ok: false as const, error: "Decision not found." };
  return applyStatus({
    decisionId: row.id,
    from: row.status as DecisionStatus,
    to: "REJECTED",
    actor: input.actor,
    action: "REJECTED",
    reason: input.reason.trim(),
    patch: {
      rejectedAt: new Date(),
      rejectedBy: input.actor.userId,
      rejectionReason: input.reason.trim(),
      reviewedAt: new Date(),
      reviewedBy: input.actor.userId,
    },
  });
}

export async function deferDecision(input: {
  decisionId: string;
  actor: Actor;
  deferredUntil: string;
  reason: string;
}) {
  if (!input.reason.trim()) {
    return { ok: false as const, error: "Deferral requires a reason." };
  }
  const until = new Date(input.deferredUntil);
  if (Number.isNaN(until.getTime())) {
    return { ok: false as const, error: "Deferral requires a valid date." };
  }
  const row = await loadDecision(input.decisionId);
  if (!row) return { ok: false as const, error: "Decision not found." };
  return applyStatus({
    decisionId: row.id,
    from: row.status as DecisionStatus,
    to: "DEFERRED",
    actor: input.actor,
    action: "DEFERRED",
    reason: input.reason.trim(),
    patch: {
      deferredUntil: until,
      reviewedAt: new Date(),
      reviewedBy: input.actor.userId,
    },
  });
}

export async function assignDecision(input: {
  decisionId: string;
  actor: Actor;
  assignedToUserId: string;
  technicianId?: string | null;
  notes?: string | null;
}) {
  if (!input.assignedToUserId.trim()) {
    return { ok: false as const, error: "Assignee is required." };
  }
  const row = await loadDecision(input.decisionId);
  if (!row) return { ok: false as const, error: "Decision not found." };
  const result = await applyStatus({
    decisionId: row.id,
    from: row.status as DecisionStatus,
    to: "ASSIGNED",
    actor: input.actor,
    action: "ASSIGNED",
    notes: input.notes,
    patch: {
      assignedToUserId: input.assignedToUserId.trim(),
      technicianId: input.technicianId ?? row.technicianId,
    },
  });
  if (result.ok) {
    notifyDecisionEvent({
      title: `Decision assigned: ${row.title}`,
      message: `Assigned to ${input.assignedToUserId}.`,
      decisionId: row.id,
      priority: "NORMAL",
    });
  }
  return result;
}

export async function startDecision(input: {
  decisionId: string;
  actor: Actor;
}) {
  const row = await loadDecision(input.decisionId);
  if (!row) return { ok: false as const, error: "Decision not found." };
  return applyStatus({
    decisionId: row.id,
    from: row.status as DecisionStatus,
    to: "IN_PROGRESS",
    actor: input.actor,
    action: "STARTED",
  });
}

export async function completeDecision(input: {
  decisionId: string;
  actor: Actor;
  completionNotes?: string | null;
  outcomeUseful?: boolean | null;
  outcomeConfirmed?: boolean | null;
  outcomeDowntimeAvoided?: boolean | null;
  outcomeActualLaborMinutes?: number | null;
  outcomeActualCost?: number | null;
  usefulRating?: number | null;
}) {
  const row = await loadDecision(input.decisionId);
  if (!row) return { ok: false as const, error: "Decision not found." };
  const result = await applyStatus({
    decisionId: row.id,
    from: row.status as DecisionStatus,
    to: "COMPLETED",
    actor: input.actor,
    action: "COMPLETED",
    notes: input.completionNotes,
    patch: {
      completedAt: new Date(),
      completedBy: input.actor.userId,
      completionNotes: input.completionNotes ?? null,
      outcomeUseful: input.outcomeUseful ?? null,
      outcomeConfirmed: input.outcomeConfirmed ?? null,
      outcomeDowntimeAvoided: input.outcomeDowntimeAvoided ?? null,
      outcomeActualLaborMinutes: input.outcomeActualLaborMinutes ?? null,
      outcomeActualCost: input.outcomeActualCost ?? null,
      usefulRating: input.usefulRating ?? null,
    },
  });
  if (result.ok) {
    notifyDecisionEvent({
      title: `Decision completed: ${row.title}`,
      message: input.completionNotes ?? "Marked complete.",
      decisionId: row.id,
      priority: "NORMAL",
    });
  }
  return result;
}

export async function cancelDecision(input: {
  decisionId: string;
  actor: Actor;
  reason?: string | null;
}) {
  const row = await loadDecision(input.decisionId);
  if (!row) return { ok: false as const, error: "Decision not found." };
  return applyStatus({
    decisionId: row.id,
    from: row.status as DecisionStatus,
    to: "CANCELLED",
    actor: input.actor,
    action: "CANCELLED",
    reason: input.reason,
  });
}

export async function recordDecisionFeedback(input: {
  decisionId: string;
  actor: Actor;
  usefulRating?: number | null;
  outcomeUseful?: boolean | null;
  outcomeConfirmed?: boolean | null;
  outcomeDowntimeAvoided?: boolean | null;
  outcomeActualLaborMinutes?: number | null;
  outcomeActualCost?: number | null;
  notes?: string | null;
}) {
  const row = await loadDecision(input.decisionId);
  if (!row) return { ok: false as const, error: "Decision not found." };
  const updated = await prisma.decisionRecommendation.update({
    where: { id: row.id },
    data: {
      usefulRating: input.usefulRating ?? row.usefulRating,
      outcomeUseful: input.outcomeUseful ?? row.outcomeUseful,
      outcomeConfirmed: input.outcomeConfirmed ?? row.outcomeConfirmed,
      outcomeDowntimeAvoided:
        input.outcomeDowntimeAvoided ?? row.outcomeDowntimeAvoided,
      outcomeActualLaborMinutes:
        input.outcomeActualLaborMinutes ?? row.outcomeActualLaborMinutes,
      outcomeActualCost: input.outcomeActualCost ?? row.outcomeActualCost,
      outcomeFeedbackJson: JSON.stringify({
        notes: input.notes ?? null,
        recordedAt: new Date().toISOString(),
        by: input.actor.userId,
      }),
    },
  });
  await writeDecisionHistory({
    decisionId: row.id,
    action: "FEEDBACK",
    fromStatus: row.status,
    toStatus: row.status,
    actorUserId: input.actor.userId,
    actorName: input.actor.displayName,
    notes: input.notes,
    metadata: {
      usefulRating: input.usefulRating,
      outcomeUseful: input.outcomeUseful,
    },
  });
  return { ok: true as const, decision: updated };
}
