import type { WorkOrderQueueComparison } from "./office-queue-compare";

export type OfficeRolloutGuardStatus = "ready" | "blocked";

export type OfficeRolloutGuardResult = {
  status: OfficeRolloutGuardStatus;
  readyToEnableOfficeFlag: boolean;
  reasons: string[];
  summary: {
    browserCount: number;
    serverCount: number;
    matchedCount: number;
    missingOnServerCount: number;
    missingOnBrowserCount: number;
    mismatchCount: number;
  };
};

export function evaluateOfficeRolloutGuard(
  comparison: WorkOrderQueueComparison,
): OfficeRolloutGuardResult {
  const reasons: string[] = [];

  if (comparison.missingOnServer.length > 0) {
    reasons.push(
      `${comparison.missingOnServer.length} browser work order(s) are missing on the server.`,
    );
  }
  if (comparison.missingOnBrowser.length > 0) {
    reasons.push(
      `${comparison.missingOnBrowser.length} server work order(s) are missing in the browser queue.`,
    );
  }
  if (comparison.mismatchCount > 0) {
    reasons.push(
      `${comparison.mismatchCount} assignment, schedule, status, or updated-time mismatch(es) on matched records.`,
    );
  }

  const ready = reasons.length === 0;

  return {
    status: ready ? "ready" : "blocked",
    readyToEnableOfficeFlag: ready,
    reasons: ready
      ? ["Browser and server queues align. You may enable MATRIX_SERVER_OFFICE_WORK_ORDERS after manager approval."]
      : reasons,
    summary: {
      browserCount: comparison.browserCount,
      serverCount: comparison.serverCount,
      matchedCount: comparison.matchedCount,
      missingOnServerCount: comparison.missingOnServer.length,
      missingOnBrowserCount: comparison.missingOnBrowser.length,
      mismatchCount: comparison.mismatchCount,
    },
  };
}
