import type { MatrixUserProfile } from "@/lib/auth/types";

export type OfficePilotSignoffStatus = "none" | "approved" | "denied" | "revoked";

export type OfficePilotSignoffDecision = "approve" | "deny" | "revoke";

export const OFFICE_PILOT_SIGNOFF_ACTIONS = {
  approve: "OFFICE_SERVER_PILOT_SIGNOFF_APPROVED",
  deny: "OFFICE_SERVER_PILOT_SIGNOFF_DENIED",
  revoke: "OFFICE_SERVER_PILOT_SIGNOFF_REVOKED",
} as const;

export const OFFICE_PILOT_AUDIT_ENTITY_TYPE = "OfficeServerQueuePilot";

export function getConfiguredOfficePilotManager(): string | null {
  const value = process.env.MATRIX_SERVER_OFFICE_PILOT_MANAGER?.trim();
  return value || null;
}

export function normalizePilotIdentity(value: string): string {
  return value.trim().toLowerCase();
}

export function officePilotEntityId(configuredPilotManager: string): string {
  return normalizePilotIdentity(configuredPilotManager);
}

export function matchesOfficePilotManager(
  profile: Pick<MatrixUserProfile, "userId" | "email" | "displayName">,
  configuredPilotManager: string,
): boolean {
  const key = normalizePilotIdentity(configuredPilotManager);
  const candidates = [profile.userId, profile.email, profile.displayName].filter(
    (value): value is string => Boolean(value?.trim()),
  );
  return candidates.some((value) => normalizePilotIdentity(value) === key);
}

export type OfficePilotRolloutCheck =
  | { state: "not-required" }
  | { state: "pending" }
  | {
      state: "ready";
      pilotManagerConfigured: boolean;
      signoffStatus: OfficePilotSignoffStatus;
      isNamedPilotManager: boolean;
    };

export function resolvePilotSignoffStatus(
  action: string | undefined,
): OfficePilotSignoffStatus {
  if (action === OFFICE_PILOT_SIGNOFF_ACTIONS.approve) return "approved";
  if (action === OFFICE_PILOT_SIGNOFF_ACTIONS.deny) return "denied";
  if (action === OFFICE_PILOT_SIGNOFF_ACTIONS.revoke) return "revoked";
  return "none";
}

export function isOfficePilotServerQueueEligible(input: {
  officeFlagEnabled: boolean;
  guardReady: boolean;
  pilotManagerConfigured: boolean;
  signoffStatus: OfficePilotSignoffStatus;
  isNamedPilotManager: boolean;
}): boolean {
  return (
    input.officeFlagEnabled &&
    input.guardReady &&
    input.pilotManagerConfigured &&
    input.signoffStatus === "approved" &&
    input.isNamedPilotManager
  );
}

export function officePilotBlockedReasons(input: {
  officeFlagEnabled: boolean;
  pilotManagerConfigured: boolean;
  configuredPilotManager: string | null;
  signoffStatus: OfficePilotSignoffStatus;
  isNamedPilotManager: boolean;
  guardReady: boolean;
  guardBlockedReasons: string[];
}): string[] {
  if (!input.officeFlagEnabled) return [];
  if (!input.guardReady) return input.guardBlockedReasons;
  const reasons: string[] = [];
  if (!input.pilotManagerConfigured) {
    reasons.push("Set MATRIX_SERVER_OFFICE_PILOT_MANAGER to the pilot manager email, user id, or display name.");
  }
  if (input.signoffStatus !== "approved") {
    reasons.push(
      input.signoffStatus === "none"
        ? "Pilot manager sign-off is required before the server queue is enabled."
        : `Pilot sign-off is ${input.signoffStatus}; approve again after guard and rollback checks pass.`,
    );
  }
  if (input.pilotManagerConfigured && !input.isNamedPilotManager) {
    reasons.push(
      `One-manager pilot is limited to ${input.configuredPilotManager ?? "the configured pilot manager"}.`,
    );
  }
  return reasons;
}
