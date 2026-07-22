/**
 * Patch 51A.4 — Valid status transitions for decisions.
 */

import type { DecisionStatus } from "./types";

const TRANSITIONS: Record<DecisionStatus, DecisionStatus[]> = {
  NEW: ["REVIEW_REQUIRED", "APPROVED", "REJECTED", "DEFERRED", "ASSIGNED", "CANCELLED", "EXPIRED"],
  REVIEW_REQUIRED: ["APPROVED", "REJECTED", "DEFERRED", "ASSIGNED", "CANCELLED", "EXPIRED"],
  APPROVED: ["ASSIGNED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "DEFERRED"],
  REJECTED: ["CANCELLED"],
  DEFERRED: ["REVIEW_REQUIRED", "APPROVED", "ASSIGNED", "CANCELLED", "EXPIRED"],
  ASSIGNED: ["IN_PROGRESS", "COMPLETED", "DEFERRED", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "DEFERRED", "CANCELLED"],
  COMPLETED: [],
  EXPIRED: [],
  CANCELLED: [],
};

export function canTransitionDecision(
  from: DecisionStatus,
  to: DecisionStatus,
): boolean {
  if (from === to) return true;
  return (TRANSITIONS[from] ?? []).includes(to);
}

export function assertDecisionTransition(
  from: DecisionStatus,
  to: DecisionStatus,
): { ok: true } | { ok: false; error: string } {
  if (!canTransitionDecision(from, to)) {
    return {
      ok: false,
      error: `Cannot move a decision from ${from} to ${to}.`,
    };
  }
  return { ok: true };
}
