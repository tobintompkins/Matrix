import type { MatrixUserProfile } from "@/lib/auth/types";
import type { OfficeRolloutGuardResult } from "./office-rollout-guard";
import {
  getConfiguredOfficePilotManager,
  isOfficePilotServerQueueEligible,
  matchesOfficePilotManager,
  type OfficePilotRolloutCheck,
} from "./office-pilot";
import type { OfficePilotSignoffAuditEntry, OfficePilotSignoffRecord } from "./office-pilot-signoff";

export type OfficePilotStatus = {
  officeFlagEnabled: boolean;
  pilotManager: string | null;
  pilotManagerConfigured: boolean;
  isNamedPilotManager: boolean;
  signoff: OfficePilotSignoffRecord;
  guardReady: boolean;
  pilotServerQueueEnabled: boolean;
  rollbackSteps: string[];
  signoffAudits: OfficePilotSignoffAuditEntry[];
};

const ROLLBACK_STEPS = [
  "Set MATRIX_SERVER_OFFICE_WORK_ORDERS=false in the deployment environment.",
  "Restart the Matrix app so all users return to the browser queue.",
  "Optionally revoke pilot sign-off from the Work Orders dashboard.",
  "Do not delete browser session storage or server WorkOrder rows.",
];

export function buildOfficePilotRolloutCheck(input: {
  officeFlagEnabled: boolean;
  pilotManagerConfigured: boolean;
  signoffStatus: OfficePilotSignoffRecord["status"];
  isNamedPilotManager: boolean;
  statusLoaded: boolean;
}): OfficePilotRolloutCheck {
  if (!input.officeFlagEnabled) return { state: "not-required" };
  if (!input.statusLoaded) return { state: "pending" };
  return {
    state: "ready",
    pilotManagerConfigured: input.pilotManagerConfigured,
    signoffStatus: input.signoffStatus,
    isNamedPilotManager: input.isNamedPilotManager,
  };
}

export function buildOfficePilotStatus(input: {
  officeFlagEnabled: boolean;
  profile: Pick<MatrixUserProfile, "userId" | "email" | "displayName">;
  guard: OfficeRolloutGuardResult;
  pilotManager: string | null;
  signoff: OfficePilotSignoffRecord;
  signoffAudits: OfficePilotSignoffAuditEntry[];
}): OfficePilotStatus {
  const pilotManagerConfigured = Boolean(input.pilotManager);
  const isNamedPilotManager = input.pilotManager
    ? matchesOfficePilotManager(input.profile, input.pilotManager)
    : false;

  return {
    officeFlagEnabled: input.officeFlagEnabled,
    pilotManager: input.pilotManager,
    pilotManagerConfigured,
    isNamedPilotManager,
    signoff: input.signoff,
    guardReady: input.guard.readyToEnableOfficeFlag,
    pilotServerQueueEnabled: isOfficePilotServerQueueEligible({
      officeFlagEnabled: input.officeFlagEnabled,
      guardReady: input.guard.readyToEnableOfficeFlag,
      pilotManagerConfigured,
      signoffStatus: input.signoff.status,
      isNamedPilotManager,
    }),
    rollbackSteps: ROLLBACK_STEPS,
    signoffAudits: input.signoffAudits,
  };
}

export function getConfiguredOfficePilotManagerOrNull(): string | null {
  return getConfiguredOfficePilotManager();
}
