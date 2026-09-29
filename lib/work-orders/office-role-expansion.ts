import type { MatrixRole } from "@/lib/auth/types";
import type { OfficePilotSignoffStatus } from "./office-pilot";

export type OfficeRoleExpansionSignoffDecision = "approve" | "deny" | "revoke";

export const OFFICE_ROLE_EXPANSION_SIGNOFF_ACTIONS = {
  approve: "OFFICE_SERVER_ROLE_EXPANSION_SIGNOFF_APPROVED",
  deny: "OFFICE_SERVER_ROLE_EXPANSION_SIGNOFF_DENIED",
  revoke: "OFFICE_SERVER_ROLE_EXPANSION_SIGNOFF_REVOKED",
} as const;

export const OFFICE_ROLE_EXPANSION_AUDIT_ENTITY_TYPE = "OfficeServerQueueRoleExpansion";
export const OFFICE_ROLE_EXPANSION_ENTITY_ID = "office-role-expansion-v1";

const MATRIX_ROLES = new Set<MatrixRole>([
  "SUPER_ADMIN",
  "ADMIN",
  "SERVICE_MANAGER",
  "REGIONAL_MANAGER",
  "OPERATIONS_MANAGER",
  "DIRECTOR",
  "FIELD_TECHNICIAN",
  "WAREHOUSE_MANAGER",
  "TRAINER",
  "READ_ONLY_AUDITOR",
  "CUSTOMER_ADMIN",
  "CUSTOMER_MANAGER",
  "CUSTOMER_USER",
  "CUSTOMER_VIEWER",
]);

export function isConfiguredMatrixRole(value: string): value is MatrixRole {
  return MATRIX_ROLES.has(value as MatrixRole);
}

export function getOfficeRoleAllowlist(): MatrixRole[] {
  const raw = process.env.MATRIX_SERVER_OFFICE_ROLE_ALLOWLIST?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(isConfiguredMatrixRole);
}

export function isOfficeRoleAllowlistConfigured(): boolean {
  return getOfficeRoleAllowlist().length > 0;
}

export function isUserRoleApproved(userRole: MatrixRole, allowlist: MatrixRole[]): boolean {
  return allowlist.includes(userRole);
}

export type OfficeRoleExpansionRolloutCheck =
  | { state: "not-required" }
  | { state: "pending" }
  | {
      state: "ready";
      roleAllowlistConfigured: boolean;
      roleSignoffStatus: OfficePilotSignoffStatus;
      isApprovedRole: boolean;
      pilotSignoffApproved: boolean;
      dispatcherSignoffApproved: boolean;
    };

export function resolveRoleExpansionSignoffStatus(
  action: string | undefined,
): OfficePilotSignoffStatus {
  if (action === OFFICE_ROLE_EXPANSION_SIGNOFF_ACTIONS.approve) return "approved";
  if (action === OFFICE_ROLE_EXPANSION_SIGNOFF_ACTIONS.deny) return "denied";
  if (action === OFFICE_ROLE_EXPANSION_SIGNOFF_ACTIONS.revoke) return "revoked";
  return "none";
}

export function isOfficeRoleExpansionServerQueueEligible(input: {
  officeFlagEnabled: boolean;
  guardReady: boolean;
  pilotSignoffApproved: boolean;
  dispatcherSignoffApproved: boolean;
  roleSignoffStatus: OfficePilotSignoffStatus;
  roleAllowlistConfigured: boolean;
  isApprovedRole: boolean;
}): boolean {
  return (
    input.officeFlagEnabled &&
    input.guardReady &&
    input.pilotSignoffApproved &&
    input.dispatcherSignoffApproved &&
    input.roleAllowlistConfigured &&
    input.roleSignoffStatus === "approved" &&
    input.isApprovedRole
  );
}

export function officeRoleExpansionBlockedReasons(input: {
  officeFlagEnabled: boolean;
  guardReady: boolean;
  guardBlockedReasons: string[];
  pilotSignoffApproved: boolean;
  dispatcherSignoffApproved: boolean;
  roleAllowlistConfigured: boolean;
  roleSignoffStatus: OfficePilotSignoffStatus;
  isApprovedRole: boolean;
  userRole: MatrixRole;
}): string[] {
  if (!input.officeFlagEnabled) return [];
  if (!input.guardReady) return input.guardBlockedReasons;
  const reasons: string[] = [];
  if (!input.pilotSignoffApproved) {
    reasons.push("Named manager pilot sign-off must stay approved before role expansion.");
  }
  if (!input.dispatcherSignoffApproved) {
    reasons.push("Dispatcher group sign-off must stay approved before role expansion.");
  }
  if (!input.roleAllowlistConfigured) {
    reasons.push("Set MATRIX_SERVER_OFFICE_ROLE_ALLOWLIST with approved Matrix roles.");
  }
  if (input.roleSignoffStatus !== "approved") {
    reasons.push(
      input.roleSignoffStatus === "none"
        ? "Audited manager approval is required for office role expansion."
        : `Office role expansion sign-off is ${input.roleSignoffStatus}.`,
    );
  }
  if (input.roleAllowlistConfigured && !input.isApprovedRole) {
    reasons.push(`Role ${input.userRole} is outside the approved office role allowlist.`);
  }
  return reasons;
}

export const OFFICE_ROLE_EXPANSION_REVOKE_CONFIRMATION =
  "Revoke the office role expansion rollout? This is audited. Users in approved roles will return to the browser queue until role expansion is approved again. Pilot and dispatcher guardrails remain in place.";

export function describeEffectiveQueueReason(input: {
  userAccessMode: string;
  rolloutBlockedReasons: string[];
}): string {
  if (input.rolloutBlockedReasons.length > 0) {
    return input.rolloutBlockedReasons.join(" ");
  }
  switch (input.userAccessMode) {
    case "server-pilot-manager":
      return "Named pilot manager with approved sign-off and ready rollout guard.";
    case "server-dispatcher-allowlist":
      return "User is on the approved dispatcher identity allowlist with group sign-off.";
    case "server-role-allowlist":
      return "User Matrix role is in the approved office role allowlist with audited expansion approval.";
    case "server-expansion-beyond-allowlist":
      return "Manager-reviewed expansion approval is active beyond the configured role allowlist.";
    case "browser-default":
      return "Office server flag is off; browser queue is the default.";
    default:
      return "Browser fallback is active for this user.";
  }
}
