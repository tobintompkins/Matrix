import type { OfficeRolloutGuardResult } from "./office-rollout-guard";
import type { OfficePilotSignoffStatus } from "./office-pilot";
import type { OfficePilotSignoffRecord } from "./office-pilot-signoff";
import {
  buildOfficePilotRolloutCheck,
  type OfficePilotStatus,
} from "./office-pilot-status";
import {
  resolveOfficeQueueRollout,
  type OfficeQueueRolloutResolution,
} from "./office-queue-rollout";

export type OfficePilotGuardSummary = {
  status: "ready" | "blocked";
  readyToEnableOfficeFlag: boolean;
  reasons: string[];
  browserCount: number;
  serverCount: number;
  matchedCount: number;
  missingOnServerCount: number;
  missingOnBrowserCount: number;
  mismatchCount: number;
};

export type OfficePilotEffectiveQueue = {
  source: "browser" | "server";
  indicator: OfficeQueueRolloutResolution["indicator"];
  label: string;
  detail: string;
  browserFallbackActive: boolean;
};

export type OfficePilotLatestDecision = {
  status: OfficePilotSignoffStatus;
  action: string | null;
  occurredAt: string | null;
  actorDisplayName: string | null;
  message: string | null;
};

export type OfficePilotMonitoringView = {
  pilotManager: string | null;
  officeFlagEnabled: boolean;
  isNamedPilotManager: boolean;
  latestDecision: OfficePilotLatestDecision;
  guardSummary: OfficePilotGuardSummary;
  effectiveQueue: OfficePilotEffectiveQueue;
  pilotServerQueueEnabled: boolean;
  accessLimitedToNamedManager: true;
  revokeConfirmationMessage: string;
};

export const OFFICE_PILOT_REVOKE_CONFIRMATION =
  "Revoke the one-manager office server queue pilot? This is audited. The pilot manager and all other users will use the browser queue until sign-off is approved again. Browser records will not be deleted.";

export function buildOfficePilotGuardSummary(
  guard: OfficeRolloutGuardResult,
): OfficePilotGuardSummary {
  return {
    status: guard.status,
    readyToEnableOfficeFlag: guard.readyToEnableOfficeFlag,
    reasons: guard.reasons,
    browserCount: guard.summary.browserCount,
    serverCount: guard.summary.serverCount,
    matchedCount: guard.summary.matchedCount,
    missingOnServerCount: guard.summary.missingOnServerCount,
    missingOnBrowserCount: guard.summary.missingOnBrowserCount,
    mismatchCount: guard.summary.mismatchCount,
  };
}

export function buildOfficePilotEffectiveQueue(
  rollout: OfficeQueueRolloutResolution,
): OfficePilotEffectiveQueue {
  const browserFallbackActive = rollout.source === "browser";
  const label =
    rollout.indicator === "server-active-dispatcher"
      ? "Server queue (dispatcher allowlist)"
      : rollout.indicator === "server-active-role"
        ? "Server queue (approved Matrix role)"
        : rollout.source === "server"
        ? "Server queue (one-manager pilot)"
        : rollout.indicator === "browser-default"
          ? "Browser queue (default)"
          : "Browser queue (fallback)";

  return {
    source: rollout.source,
    indicator: rollout.indicator,
    label,
    detail: rollout.description,
    browserFallbackActive,
  };
}

export function buildManagerOfficeRolloutResolution(input: {
  officeFlagEnabled: boolean;
  guard: OfficeRolloutGuardResult;
  pilot: OfficePilotStatus;
}): OfficeQueueRolloutResolution {
  const guardCheck = {
    state: "ready" as const,
    guardReady: input.guard.readyToEnableOfficeFlag,
    blockedReasons: input.guard.readyToEnableOfficeFlag ? [] : input.guard.reasons,
  };
  const pilotCheck = buildOfficePilotRolloutCheck({
    officeFlagEnabled: input.officeFlagEnabled,
    pilotManagerConfigured: input.pilot.pilotManagerConfigured,
    signoffStatus: input.pilot.signoff.status,
    isNamedPilotManager: input.pilot.isNamedPilotManager,
    statusLoaded: true,
  });

  return resolveOfficeQueueRollout({
    officeFlagEnabled: input.officeFlagEnabled,
    isManager: true,
    guardCheck,
    pilotCheck,
    dispatcherCheck: { state: "not-required" },
    roleExpansionCheck: { state: "not-required" },
    configuredPilotManager: input.pilot.pilotManager,
    userRole: "SUPER_ADMIN",
  });
}

export function buildLatestPilotDecision(signoff: OfficePilotSignoffRecord): OfficePilotLatestDecision {
  return {
    status: signoff.status,
    action: signoff.action,
    occurredAt: signoff.occurredAt,
    actorDisplayName: signoff.actorDisplayName,
    message: signoff.message,
  };
}

export function buildOfficePilotMonitoringView(input: {
  pilot: OfficePilotStatus;
  guard: OfficeRolloutGuardResult;
  rollout: OfficeQueueRolloutResolution;
}): OfficePilotMonitoringView {
  return {
    pilotManager: input.pilot.pilotManager,
    officeFlagEnabled: input.pilot.officeFlagEnabled,
    isNamedPilotManager: input.pilot.isNamedPilotManager,
    latestDecision: buildLatestPilotDecision(input.pilot.signoff),
    guardSummary: buildOfficePilotGuardSummary(input.guard),
    effectiveQueue: buildOfficePilotEffectiveQueue(input.rollout),
    pilotServerQueueEnabled: input.pilot.pilotServerQueueEnabled,
    accessLimitedToNamedManager: true,
    revokeConfirmationMessage: OFFICE_PILOT_REVOKE_CONFIRMATION,
  };
}
