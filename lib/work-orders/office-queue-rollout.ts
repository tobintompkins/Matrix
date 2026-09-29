/**
 * Controlled office queue rollout (Steps 6–11).
 * Browser queue stays default; server queue when flag, guard, pilot, dispatcher, and/or role expansion allow.
 */

import type { MatrixRole } from "@/lib/auth/types";
import { officeDispatcherBlockedReasons, type OfficeDispatcherRolloutCheck } from "./office-dispatcher-group";
import {
  officePilotBlockedReasons,
  type OfficePilotRolloutCheck,
} from "./office-pilot";
import {
  officeRoleExpansionBlockedReasons,
  type OfficeRoleExpansionRolloutCheck,
} from "./office-role-expansion";
import {
  isOfficeExpansionBeyondRoleAllowlistEnabled,
  type OfficeExpansionReviewStatus,
} from "./office-rollout-expansion-review";

export type OfficeQueueIndicator =
  | "browser-default"
  | "server-active"
  | "server-active-pilot"
  | "server-active-dispatcher"
  | "server-active-role"
  | "server-active-expansion-review"
  | "browser-rollback";

export type OfficeExpansionReviewRolloutCheck =
  | { state: "not-required" }
  | {
      state: "ready";
      reviewStatus: OfficeExpansionReviewStatus;
      eligibleBeyondAllowlist: boolean;
    };

export type { OfficePilotRolloutCheck, OfficeDispatcherRolloutCheck, OfficeRoleExpansionRolloutCheck };

export type OfficeQueueRolloutGuardCheck =
  | { state: "not-required" }
  | { state: "pending" }
  | { state: "ready"; guardReady: boolean; blockedReasons: string[] };

export type OfficeQueueRolloutInput = {
  officeFlagEnabled: boolean;
  isManager: boolean;
  userRole: MatrixRole;
  guardCheck: OfficeQueueRolloutGuardCheck;
  pilotCheck?: OfficePilotRolloutCheck;
  dispatcherCheck?: OfficeDispatcherRolloutCheck;
  roleExpansionCheck?: OfficeRoleExpansionRolloutCheck;
  expansionReviewCheck?: OfficeExpansionReviewRolloutCheck;
  configuredPilotManager?: string | null;
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
  const { officeFlagEnabled, isManager, userRole, guardCheck } = input;

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

  const roleExpansionCheck = input.roleExpansionCheck ?? { state: "not-required" as const };
  const rolePathConfigured =
    roleExpansionCheck.state === "ready" && roleExpansionCheck.roleAllowlistConfigured;

  if (!isManager && !rolePathConfigured) {
    return {
      source: "browser",
      indicator: "browser-rollback",
      title: "Browser queue (office server rollout is manager-only)",
      description:
        "The controlled office server queue is enabled for managers and approved Matrix roles only. You are viewing the browser queue.",
      blockedReasons: [],
    };
  }

  if (guardCheck.state === "pending") {
    return {
      source: "browser",
      indicator: "browser-rollback",
      title: "Browser queue while rollout guard is checked",
      description:
        "Verifying browser/server alignment before switching to the durable server queue.",
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

  const pilotCheck = input.pilotCheck ?? { state: "pending" as const };
  const dispatcherCheck = input.dispatcherCheck ?? { state: "not-required" as const };

  if (
    pilotCheck.state === "pending" ||
    dispatcherCheck.state === "pending" ||
    roleExpansionCheck.state === "pending"
  ) {
    return {
      source: "browser",
      indicator: "browser-rollback",
      title: "Browser queue while rollout status is checked",
      description:
        "Loading pilot, dispatcher, and role expansion sign-off status before enabling the durable server queue.",
      blockedReasons: [],
    };
  }

  if (isManager && pilotCheck.state === "ready") {
    const pilotBlockedReasons = officePilotBlockedReasons({
      officeFlagEnabled,
      pilotManagerConfigured: pilotCheck.pilotManagerConfigured,
      configuredPilotManager: input.configuredPilotManager ?? null,
      signoffStatus: pilotCheck.signoffStatus,
      isNamedPilotManager: pilotCheck.isNamedPilotManager,
      guardReady: true,
      guardBlockedReasons: [],
    });
    if (pilotBlockedReasons.length === 0) {
      return {
        source: "server",
        indicator: "server-active-pilot",
        title: "Durable server work order queue (one-manager pilot active)",
        description:
          "Office server pilot is active for the named manager. This queue reads from Prisma server records. Set MATRIX_SERVER_OFFICE_WORK_ORDERS=false to roll back without deleting data.",
        blockedReasons: [],
      };
    }
  }

  if (isManager && dispatcherCheck.state === "ready") {
    const dispatcherBlockedReasons = officeDispatcherBlockedReasons({
      officeFlagEnabled,
      guardReady: true,
      guardBlockedReasons: [],
      pilotSignoffApproved: dispatcherCheck.pilotSignoffApproved,
      allowlistConfigured: dispatcherCheck.allowlistConfigured,
      groupSignoffStatus: dispatcherCheck.groupSignoffStatus,
      isOnAllowlist: dispatcherCheck.isOnAllowlist,
    });
    if (dispatcherBlockedReasons.length === 0) {
      return {
        source: "server",
        indicator: "server-active-dispatcher",
        title: "Durable server work order queue (dispatcher group active)",
        description:
          "Approved dispatcher group rollout is active for this allowlisted user. Browser fallback remains available via group revoke or flag rollback.",
        blockedReasons: [],
      };
    }
  }

  if (roleExpansionCheck.state === "ready") {
    const roleBlockedReasons = officeRoleExpansionBlockedReasons({
      officeFlagEnabled,
      guardReady: true,
      guardBlockedReasons: [],
      pilotSignoffApproved: roleExpansionCheck.pilotSignoffApproved,
      dispatcherSignoffApproved: roleExpansionCheck.dispatcherSignoffApproved,
      roleAllowlistConfigured: roleExpansionCheck.roleAllowlistConfigured,
      roleSignoffStatus: roleExpansionCheck.roleSignoffStatus,
      isApprovedRole: roleExpansionCheck.isApprovedRole,
      userRole,
    });
    if (roleBlockedReasons.length === 0) {
      return {
        source: "server",
        indicator: "server-active-role",
        title: "Durable server work order queue (approved Matrix role)",
        description:
          "Office role expansion is active for this Matrix role. Browser fallback remains available via role expansion revoke or flag rollback.",
        blockedReasons: [],
      };
    }
  }

  const expansionReviewCheck = input.expansionReviewCheck ?? { state: "not-required" as const };
  if (
    expansionReviewCheck.state === "ready" &&
    expansionReviewCheck.reviewStatus === "approved" &&
    expansionReviewCheck.eligibleBeyondAllowlist &&
    isOfficeExpansionBeyondRoleAllowlistEnabled()
  ) {
    return {
      source: "server",
      indicator: "server-active-expansion-review",
      title: "Durable server work order queue (manager expansion review)",
      description:
        "Manager-reviewed expansion beyond the configured role allowlist is active. Browser fallback remains available via hold, revoke, or flag rollback.",
      blockedReasons: [],
    };
  }

  const blockedReasons: string[] = [];
  if (isManager && pilotCheck.state === "ready") {
    blockedReasons.push(
      ...officePilotBlockedReasons({
        officeFlagEnabled,
        pilotManagerConfigured: pilotCheck.pilotManagerConfigured,
        configuredPilotManager: input.configuredPilotManager ?? null,
        signoffStatus: pilotCheck.signoffStatus,
        isNamedPilotManager: pilotCheck.isNamedPilotManager,
        guardReady: true,
        guardBlockedReasons: [],
      }),
    );
  }
  if (isManager && dispatcherCheck.state === "ready") {
    blockedReasons.push(
      ...officeDispatcherBlockedReasons({
        officeFlagEnabled,
        guardReady: true,
        guardBlockedReasons: [],
        pilotSignoffApproved: dispatcherCheck.pilotSignoffApproved,
        allowlistConfigured: dispatcherCheck.allowlistConfigured,
        groupSignoffStatus: dispatcherCheck.groupSignoffStatus,
        isOnAllowlist: dispatcherCheck.isOnAllowlist,
      }),
    );
  }
  if (roleExpansionCheck.state === "ready") {
    blockedReasons.push(
      ...officeRoleExpansionBlockedReasons({
        officeFlagEnabled,
        guardReady: true,
        guardBlockedReasons: [],
        pilotSignoffApproved: roleExpansionCheck.pilotSignoffApproved,
        dispatcherSignoffApproved: roleExpansionCheck.dispatcherSignoffApproved,
        roleAllowlistConfigured: roleExpansionCheck.roleAllowlistConfigured,
        roleSignoffStatus: roleExpansionCheck.roleSignoffStatus,
        isApprovedRole: roleExpansionCheck.isApprovedRole,
        userRole,
      }),
    );
  }

  const uniqueReasons = Array.from(new Set(blockedReasons));

  return {
    source: "browser",
    indicator: "browser-rollback",
    title: "Browser queue (controlled rollout not cleared for this user)",
    description:
      "The office server flag is on, but this user is not cleared for the pilot manager, dispatcher allowlist, or approved Matrix role expansion. Browser session storage remains the active queue.",
    blockedReasons: uniqueReasons,
  };
}

export function useServerOfficeQueueSource(
  resolution: OfficeQueueRolloutResolution,
): boolean {
  return resolution.source === "server";
}
