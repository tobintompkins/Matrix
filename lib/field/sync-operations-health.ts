export type FieldSyncHealthRow = {
  type: string;
  status: string;
  count: number;
};

export type FieldSyncOperationsHealth = {
  received: number;
  applied: number;
  rejected: number;
  oldestReceivedAt: string | null;
  byType: Array<{
    type: string;
    received: number;
    applied: number;
    rejected: number;
  }>;
};

/**
 * Convert persisted Field receipt counts into a manager-safe operations view.
 * RECEIVED remains actionable, APPLIED is retained for audit, and REJECTED
 * requires review. Unknown statuses are intentionally excluded from totals.
 */
export function buildFieldSyncOperationsHealth(
  rows: FieldSyncHealthRow[],
  oldestReceivedAt: Date | string | null,
): FieldSyncOperationsHealth {
  const byType = new Map<string, { received: number; applied: number; rejected: number }>();
  let received = 0;
  let applied = 0;
  let rejected = 0;

  for (const row of rows) {
    if (!row.type || !Number.isFinite(row.count) || row.count < 0) continue;
    if (row.status !== "RECEIVED" && row.status !== "APPLIED" && row.status !== "REJECTED") continue;

    const entry = byType.get(row.type) ?? { received: 0, applied: 0, rejected: 0 };
    const count = Math.floor(row.count);
    if (row.status === "RECEIVED") {
      entry.received += count;
      received += count;
    } else if (row.status === "APPLIED") {
      entry.applied += count;
      applied += count;
    } else {
      entry.rejected += count;
      rejected += count;
    }
    byType.set(row.type, entry);
  }

  return {
    received,
    applied,
    rejected,
    oldestReceivedAt: oldestReceivedAt
      ? new Date(oldestReceivedAt).toISOString()
      : null,
    byType: [...byType.entries()]
      .map(([type, counts]) => ({ type, ...counts }))
      .sort((left, right) => left.type.localeCompare(right.type)),
  };
}
