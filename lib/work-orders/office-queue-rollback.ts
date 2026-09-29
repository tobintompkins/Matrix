import type { WorkOrder } from "./types";
import type { OfficePilotSignoffStatus } from "./office-pilot";
import {
  resolveOfficeQueueRollout,
  type OfficeQueueRolloutGuardCheck,
  type OfficeQueueRolloutResolution,
} from "./office-queue-rollout";

export type BrowserQueueSnapshot = {
  recordCount: number;
  fingerprint: string;
  orderIds: string[];
};

export type OfficeRollbackCheck = {
  id: string;
  label: string;
  pass: boolean;
  detail: string;
};

export type OfficeRollbackValidation = {
  rollbackReady: boolean;
  checks: OfficeRollbackCheck[];
  managerRollout: OfficeQueueRolloutResolution;
  rollbackSteps: string[];
};

export function captureBrowserQueueSnapshot(orders: WorkOrder[]): BrowserQueueSnapshot {
  const sorted = [...orders].sort((a, b) => a.id.localeCompare(b.id));
  return {
    recordCount: sorted.length,
    fingerprint: sorted
      .map((order) => `${order.id}|${order.workOrderNumber}|${order.updatedAt}`)
      .join("\n"),
    orderIds: sorted.map((order) => order.id),
  };
}

export function browserSnapshotMatchesWorkOrders(
  snapshot: BrowserQueueSnapshot,
  orders: WorkOrder[],
): boolean {
  return captureBrowserQueueSnapshot(orders).fingerprint === snapshot.fingerprint;
}

export function resolveManagerOfficeRollout(
  officeFlagEnabled: boolean,
  guardCheck: OfficeQueueRolloutGuardCheck,
  options?: {
    pilotSignoffStatus?: OfficePilotSignoffStatus;
    isNamedPilotManager?: boolean;
    pilotManagerConfigured?: boolean;
    configuredPilotManager?: string | null;
  },
): OfficeQueueRolloutResolution {
  const pilotCheck =
    options?.pilotSignoffStatus !== undefined
      ? {
          state: "ready" as const,
          pilotManagerConfigured: options.pilotManagerConfigured ?? true,
          signoffStatus: options.pilotSignoffStatus,
          isNamedPilotManager: options.isNamedPilotManager ?? false,
        }
      : { state: "pending" as const };

  return resolveOfficeQueueRollout({
    officeFlagEnabled,
    isManager: true,
    userRole: "SUPER_ADMIN",
    guardCheck,
    pilotCheck,
    dispatcherCheck: { state: "not-required" },
    roleExpansionCheck: { state: "not-required" },
    configuredPilotManager: options?.configuredPilotManager ?? null,
  });
}

export function guardToRolloutCheck(
  guardReady: boolean,
  blockedReasons: string[],
): OfficeQueueRolloutGuardCheck {
  return { state: "ready", guardReady, blockedReasons };
}

export function validateOfficeBrowserRollback(input: {
  officeFlagEnabled: boolean;
  guardReady: boolean;
  guardBlockedReasons: string[];
  snapshotBefore: BrowserQueueSnapshot;
  snapshotAfter: BrowserQueueSnapshot;
  snapshotMatchesRequest?: boolean;
  pilotSignoffStatus?: OfficePilotSignoffStatus;
  isNamedPilotManager?: boolean;
  pilotManagerConfigured?: boolean;
  configuredPilotManager?: string | null;
}): OfficeRollbackValidation {
  const guardCheck = guardToRolloutCheck(input.guardReady, input.guardBlockedReasons);
  const managerRollout = resolveManagerOfficeRollout(input.officeFlagEnabled, guardCheck, {
    pilotSignoffStatus: input.pilotSignoffStatus,
    isNamedPilotManager: input.isNamedPilotManager,
    pilotManagerConfigured: input.pilotManagerConfigured,
    configuredPilotManager: input.configuredPilotManager,
  });

  const rollbackSteps = [
    "Set MATRIX_SERVER_OFFICE_WORK_ORDERS=false in the deployment environment.",
    "Restart the Matrix app so the office UI reads the browser session queue again.",
    "Do not delete browser session storage, server WorkOrder rows, or Field offline packages.",
    "Re-run Browser Rollback Validation on the Work Orders dashboard before expanding the pilot.",
  ];

  const checks: OfficeRollbackCheck[] = [];

  checks.push({
    id: "browser-data-unchanged",
    label: "Browser queue unchanged during validation",
    pass: input.snapshotBefore.fingerprint === input.snapshotAfter.fingerprint,
    detail:
      input.snapshotBefore.fingerprint === input.snapshotAfter.fingerprint
        ? `${input.snapshotAfter.recordCount} browser work order(s); no session data was modified by this check.`
        : "Browser session data changed during the rollback validation request. Investigate before enabling the server queue.",
  });

  if (input.snapshotMatchesRequest !== undefined) {
    checks.push({
      id: "snapshot-matches-payload",
      label: "Submitted snapshot matches browser payload",
      pass: input.snapshotMatchesRequest,
      detail: input.snapshotMatchesRequest
        ? "The validation request used a consistent browser queue snapshot."
        : "Browser work orders and snapshot fingerprint did not match.",
    });
  }

  checks.push({
    id: "browser-queue-readable",
    label: "Browser queue remains available",
    pass: input.snapshotAfter.recordCount === input.snapshotBefore.recordCount,
    detail: `${input.snapshotAfter.recordCount} work order(s) in browser session storage.`,
  });

  if (!input.officeFlagEnabled) {
    checks.push({
      id: "flag-off-default-browser",
      label: "Office flag off uses browser queue (default rollback)",
      pass:
        managerRollout.source === "browser" && managerRollout.indicator === "browser-default",
      detail:
        "MATRIX_SERVER_OFFICE_WORK_ORDERS is false; managers and dispatchers read the browser queue.",
    });
  } else if (managerRollout.indicator === "browser-rollback") {
    checks.push({
      id: "automatic-browser-fallback",
      label: "Automatic browser fallback while flag is on",
      pass: managerRollout.source === "browser",
      detail:
        "Flag is on but the UI is on the browser queue (guard blocked, pending, or non-manager path). Browser records are preserved.",
    });
  } else {
    checks.push({
      id: "env-flag-rollback",
      label: "Environment flag rollback path documented",
      pass: true,
      detail:
        "Server queue is active for this manager. Roll back by setting MATRIX_SERVER_OFFICE_WORK_ORDERS=false; browser session data is not deleted.",
    });
  }

  checks.push({
    id: "no-destructive-rollback",
    label: "Rollback does not require data deletion",
    pass: true,
    detail:
      "Rollback is a read-source switch only. Keep browser and server WorkOrder records intact.",
  });

  const rollbackReady = checks.every((check) => check.pass);

  return {
    rollbackReady,
    checks,
    managerRollout,
    rollbackSteps,
  };
}
