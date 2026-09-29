import type { MatrixUserProfile } from "@/lib/auth/types";
import { normalizePilotIdentity } from "./office-pilot";
import type { OfficePilotSignoffStatus } from "./office-pilot";

export type OfficeDispatcherSignoffDecision = "approve" | "deny" | "revoke";

export const OFFICE_DISPATCHER_SIGNOFF_ACTIONS = {
  approve: "OFFICE_SERVER_DISPATCHER_GROUP_SIGNOFF_APPROVED",
  deny: "OFFICE_SERVER_DISPATCHER_GROUP_SIGNOFF_DENIED",
  revoke: "OFFICE_SERVER_DISPATCHER_GROUP_SIGNOFF_REVOKED",
} as const;

export const OFFICE_DISPATCHER_AUDIT_ENTITY_TYPE = "OfficeServerQueueDispatcherGroup";
export const OFFICE_DISPATCHER_GROUP_ENTITY_ID = "office-dispatcher-group-v1";

export function getOfficeDispatcherAllowlist(): string[] {
  const raw = process.env.MATRIX_SERVER_OFFICE_DISPATCHER_ALLOWLIST?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function isOfficeDispatcherAllowlistConfigured(): boolean {
  return getOfficeDispatcherAllowlist().length > 0;
}

export function matchesOfficeDispatcherAllowlist(
  profile: Pick<MatrixUserProfile, "userId" | "email" | "displayName">,
  allowlist: string[],
): boolean {
  if (allowlist.length === 0) return false;
  const keys = new Set(allowlist.map(normalizePilotIdentity));
  const candidates = [profile.userId, profile.email, profile.displayName].filter(
    (value): value is string => Boolean(value?.trim()),
  );
  return candidates.some((value) => keys.has(normalizePilotIdentity(value)));
}

export type OfficeDispatcherRolloutCheck =
  | { state: "not-required" }
  | { state: "pending" }
  | {
      state: "ready";
      allowlistConfigured: boolean;
      groupSignoffStatus: OfficePilotSignoffStatus;
      isOnAllowlist: boolean;
      pilotSignoffApproved: boolean;
    };

export function resolveDispatcherSignoffStatus(
  action: string | undefined,
): OfficePilotSignoffStatus {
  if (action === OFFICE_DISPATCHER_SIGNOFF_ACTIONS.approve) return "approved";
  if (action === OFFICE_DISPATCHER_SIGNOFF_ACTIONS.deny) return "denied";
  if (action === OFFICE_DISPATCHER_SIGNOFF_ACTIONS.revoke) return "revoked";
  return "none";
}

export function isOfficeDispatcherServerQueueEligible(input: {
  officeFlagEnabled: boolean;
  guardReady: boolean;
  pilotSignoffApproved: boolean;
  groupSignoffStatus: OfficePilotSignoffStatus;
  allowlistConfigured: boolean;
  isOnAllowlist: boolean;
}): boolean {
  return (
    input.officeFlagEnabled &&
    input.guardReady &&
    input.pilotSignoffApproved &&
    input.allowlistConfigured &&
    input.groupSignoffStatus === "approved" &&
    input.isOnAllowlist
  );
}

export function officeDispatcherBlockedReasons(input: {
  officeFlagEnabled: boolean;
  guardReady: boolean;
  guardBlockedReasons: string[];
  pilotSignoffApproved: boolean;
  allowlistConfigured: boolean;
  groupSignoffStatus: OfficePilotSignoffStatus;
  isOnAllowlist: boolean;
}): string[] {
  if (!input.officeFlagEnabled) return [];
  if (!input.guardReady) return input.guardBlockedReasons;
  const reasons: string[] = [];
  if (!input.pilotSignoffApproved) {
    reasons.push(
      "Named manager pilot sign-off must stay approved before dispatcher group access is enabled.",
    );
  }
  if (!input.allowlistConfigured) {
    reasons.push("Set MATRIX_SERVER_OFFICE_DISPATCHER_ALLOWLIST with approved dispatcher identities.");
  }
  if (input.groupSignoffStatus !== "approved") {
    reasons.push(
      input.groupSignoffStatus === "none"
        ? "Dispatcher group manager sign-off is required before allowlisted users can use the server queue."
        : `Dispatcher group sign-off is ${input.groupSignoffStatus}.`,
    );
  }
  if (input.allowlistConfigured && !input.isOnAllowlist) {
    reasons.push("This user is outside the approved dispatcher allowlist.");
  }
  return reasons;
}

export const OFFICE_DISPATCHER_GROUP_REVOKE_CONFIRMATION =
  "Revoke the dispatcher group office server queue rollout? This is audited. Allowlisted dispatchers will return to the browser queue until the group is approved again. The named pilot manager requirement and browser records remain intact.";
