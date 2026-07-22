/**
 * Patch 51A.5 Part 1 — Deterministic operational priority ranking.
 */

import type { ExecutivePriorityItem, ExecutivePrioritySeverity } from "./types";

const SEVERITY_RANK: Record<ExecutivePrioritySeverity, number> = {
  CRITICAL: 400,
  HIGH: 300,
  MEDIUM: 200,
  LOW: 100,
  INFO: 0,
};

export function prioritySortKey(
  severity: ExecutivePrioritySeverity,
  overdueBoost: boolean,
  createdAt?: string | null,
): number {
  const ageMs = createdAt
    ? Math.max(0, Date.now() - new Date(createdAt).getTime())
    : 0;
  // Higher = more urgent. Newer events get a small boost within severity band.
  const recency = Math.max(0, 50_000 - Math.min(ageMs / 1000, 50_000));
  return SEVERITY_RANK[severity] + (overdueBoost ? 40 : 0) + recency / 1000;
}

export function sortExecutivePriorities(
  items: ExecutivePriorityItem[],
): ExecutivePriorityItem[] {
  return items
    .slice()
    .sort((a, b) => {
      if (b.sortKey !== a.sortKey) return b.sortKey - a.sortKey;
      return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
    })
    .slice(0, 20);
}
