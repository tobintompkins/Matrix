/**
 * Controlled manager-only office queue rollout (Step 6).
 * Browser queue stays default; server queue only when flag + manager + guard ready.
 */

export type OfficeQueueIndicator = "browser-default" | "server-active" | "browser-rollback";

export type OfficeQueueRolloutGuardCheck =
  | { state: "not-required" }
  | { state: "pending" }
  | { state: "ready"; guardReady: boolean; blockedReasons: string[] };

export type OfficeQueueRolloutInput = {
  officeFlagEnabled: boolean;
  isManager: boolean;
  guardCheck: OfficeQueueRolloutGuardCheck;
};

export type OfficeQueueRolloutResolution = {
  source: "browser" | "server";
  indicator: OfficeQueueIndicator;
  title: string;
  description: string;
  blockedReasons: string[];
};

export function resolveOfficeQueueRollout(
  input: OfficeQueueRolloutInput,
): OfficeQueueRolloutResolution {
  const { officeFlagEnabled, isManager, guardCheck } = input;

  if (!officeFlagEnabled) {
    return {
      source: "browser",
      indicator: "browser-default",
      title: "Browser work order queue",
      description:
        "MATRIX_SERVER_OFFICE_WORK_ORDERS is off. This queue reads from browser session storage. Server records are unchanged.",
      blockedReasons: [],
    };
  }

  if (!isManager) {
    return {
      source: "browser",
      indicator: "browser-rollback",
      title: "Browser queue (office server rollout is manager-only)",
      description:
        "The controlled office server queue is enabled for managers only. You are viewing the browser queue; no browser records are modified.",
      blockedReasons: [],
    };
  }

  if (guardCheck.state === "pending") {
    return {
      source: "browser",
      indicator: "browser-rollback",
      title: "Browser queue while rollout guard is checked",
      description:
        "Verifying browser/server alignment before switching managers to the durable server queue.",
      blockedReasons: [],
    };
  }

  if (guardCheck.state === "ready" && !guardCheck.guardReady) {
    return {
      source: "browser",
      indicator: "browser-rollback",
      title: "Browser queue (rollout guard blocked)",
      description:
        "MATRIX_SERVER_OFFICE_WORK_ORDERS is on, but comparison found gaps or mismatches. Using the browser queue until the guard is ready. Browser records are preserved.",
      blockedReasons: guardCheck.blockedReasons,
    };
  }

  return {
    source: "server",
    indicator: "server-active",
    title: "Durable server work order queue (active)",
    description:
      "Office server rollout is active for this manager. This queue reads from Prisma server records. Set MATRIX_SERVER_OFFICE_WORK_ORDERS=false to roll back without deleting data.",
    blockedReasons: [],
  };
}

export function useServerOfficeQueueSource(
  resolution: OfficeQueueRolloutResolution,
): boolean {
  return resolution.source === "server";
}
