import type { MatrixRole } from "@/lib/auth/types";
import type { WorkOrderQueueComparison } from "./office-queue-compare";
import type { OfficeRolloutGuardResult } from "./office-rollout-guard";
import type { OfficePilotSignoffStatus } from "./office-pilot";

export type OfficeExpansionReviewDecision = "approve" | "hold" | "revoke";

export const OFFICE_EXPANSION_REVIEW_ACTIONS = {
  approve: "OFFICE_SERVER_ROLLOUT_EXPANSION_REVIEW_APPROVED",
  hold: "OFFICE_SERVER_ROLLOUT_EXPANSION_HOLD",
  revoke: "OFFICE_SERVER_ROLLOUT_EXPANSION_REVOKED",
} as const;

export const OFFICE_EXPANSION_REVIEW_AUDIT_ENTITY_TYPE = "OfficeServerQueueExpansionReview";
export const OFFICE_EXPANSION_REVIEW_ENTITY_ID = "office-rollout-expansion-review-v1";

export type OfficeExpansionReviewStatus = "none" | "approved" | "held" | "revoked";

export type OfficeExpansionReviewAuditEntry = {
  id: string;
  action: string;
  occurredAt: string;
  actorId: string | null;
  message: string | null;
};

export function isOfficeExpansionBeyondRoleAllowlistEnabled(): boolean {
  return (
    (process.env.MATRIX_SERVER_OFFICE_EXPANSION_BEYOND_ROLES ?? "").trim().toLowerCase() ===
    "true"
  );
}

export function resolveExpansionReviewStatus(action: string | undefined): OfficeExpansionReviewStatus {
  if (action === OFFICE_EXPANSION_REVIEW_ACTIONS.approve) return "approved";
  if (action === OFFICE_EXPANSION_REVIEW_ACTIONS.hold) return "held";
  if (action === OFFICE_EXPANSION_REVIEW_ACTIONS.revoke) return "revoked";
  return "none";
}

export type OfficeRolloutExpansionReviewSummary = {
  officeFlagEnabled: boolean;
  guard: OfficeRolloutGuardResult;
  comparisonHealth: {
    readyForOfficeFlag: boolean;
    browserCount: number;
    serverCount: number;
    mismatchCount: number;
    missingOnServerCount: number;
    missingOnBrowserCount: number;
  };
  pilot: {
    manager: string | null;
    signoffStatus: OfficePilotSignoffStatus;
  };
  dispatcher: {
    allowlistCount: number;
    signoffStatus: OfficePilotSignoffStatus;
  };
  roleExpansion: {
    allowlist: MatrixRole[];
    signoffStatus: OfficePilotSignoffStatus;
  };
  expansionReviewStatus: OfficeExpansionReviewStatus;
  expansionBeyondRolesFlagEnabled: boolean;
  readyForManagerReview: boolean;
  reviewBlockers: string[];
  recentAudits: OfficeExpansionReviewAuditEntry[];
};

export function buildExpansionReviewReadiness(input: {
  guard: OfficeRolloutGuardResult;
  pilotSignoffStatus: OfficePilotSignoffStatus;
  dispatcherSignoffStatus: OfficePilotSignoffStatus;
  roleExpansionSignoffStatus: OfficePilotSignoffStatus;
  roleAllowlistConfigured: boolean;
}): { ready: boolean; blockers: string[] } {
  const blockers: string[] = [];
  if (!input.guard.readyToEnableOfficeFlag) {
    blockers.push("Rollout guard must be ready before expansion review approval.");
  }
  if (input.pilotSignoffStatus !== "approved") {
    blockers.push("Named manager pilot sign-off must be approved.");
  }
  if (input.dispatcherSignoffStatus !== "approved") {
    blockers.push("Dispatcher group sign-off must be approved.");
  }
  if (input.roleExpansionSignoffStatus !== "approved") {
    blockers.push("Office role expansion sign-off must be approved.");
  }
  if (!input.roleAllowlistConfigured) {
    blockers.push("Configure MATRIX_SERVER_OFFICE_ROLE_ALLOWLIST before expansion review.");
  }
  return { ready: blockers.length === 0, blockers };
}

export function buildOfficeRolloutExpansionReviewSummary(input: {
  officeFlagEnabled: boolean;
  guard: OfficeRolloutGuardResult;
  comparison: WorkOrderQueueComparison;
  pilotManager: string | null;
  pilotSignoffStatus: OfficePilotSignoffStatus;
  dispatcherAllowlistCount: number;
  dispatcherSignoffStatus: OfficePilotSignoffStatus;
  roleAllowlist: MatrixRole[];
  roleExpansionSignoffStatus: OfficePilotSignoffStatus;
  expansionReviewStatus: OfficeExpansionReviewStatus;
  recentAudits: OfficeExpansionReviewAuditEntry[];
}): OfficeRolloutExpansionReviewSummary {
  const readiness = buildExpansionReviewReadiness({
    guard: input.guard,
    pilotSignoffStatus: input.pilotSignoffStatus,
    dispatcherSignoffStatus: input.dispatcherSignoffStatus,
    roleExpansionSignoffStatus: input.roleExpansionSignoffStatus,
    roleAllowlistConfigured: input.roleAllowlist.length > 0,
  });

  return {
    officeFlagEnabled: input.officeFlagEnabled,
    guard: input.guard,
    comparisonHealth: {
      readyForOfficeFlag: input.comparison.readyForOfficeFlag,
      browserCount: input.comparison.browserCount,
      serverCount: input.comparison.serverCount,
      mismatchCount: input.comparison.mismatchCount,
      missingOnServerCount: input.comparison.missingOnServer.length,
      missingOnBrowserCount: input.comparison.missingOnBrowser.length,
    },
    pilot: {
      manager: input.pilotManager,
      signoffStatus: input.pilotSignoffStatus,
    },
    dispatcher: {
      allowlistCount: input.dispatcherAllowlistCount,
      signoffStatus: input.dispatcherSignoffStatus,
    },
    roleExpansion: {
      allowlist: input.roleAllowlist,
      signoffStatus: input.roleExpansionSignoffStatus,
    },
    expansionReviewStatus: input.expansionReviewStatus,
    expansionBeyondRolesFlagEnabled: isOfficeExpansionBeyondRoleAllowlistEnabled(),
    readyForManagerReview: readiness.ready,
    reviewBlockers: readiness.blockers,
    recentAudits: input.recentAudits,
  };
}

export function isOfficeExpansionBeyondAllowlistEligible(input: {
  officeFlagEnabled: boolean;
  guardReady: boolean;
  pilotSignoffApproved: boolean;
  dispatcherSignoffApproved: boolean;
  roleExpansionSignoffApproved: boolean;
  expansionReviewApproved: boolean;
  expansionBeyondRolesFlagEnabled: boolean;
  isManager: boolean;
  isOnRoleAllowlist: boolean;
  isNamedPilotManager: boolean;
  isOnDispatcherAllowlist: boolean;
}): boolean {
  if (
    input.isNamedPilotManager ||
    input.isOnDispatcherAllowlist ||
    input.isOnRoleAllowlist
  ) {
    return false;
  }
  return (
    input.expansionBeyondRolesFlagEnabled &&
    input.officeFlagEnabled &&
    input.guardReady &&
    input.pilotSignoffApproved &&
    input.dispatcherSignoffApproved &&
    input.roleExpansionSignoffApproved &&
    input.expansionReviewApproved &&
    input.isManager
  );
}

export const OFFICE_EXPANSION_REVIEW_APPROVE_CONFIRMATION =
  "OFFICE_ROLLOUT_EXPANSION_REVIEW";

export const OFFICE_EXPANSION_HOLD_CONFIRMATION =
  "I confirm holding office rollout expansion. Audited managers may not expand beyond the configured role allowlist until review is approved again.";

export const OFFICE_EXPANSION_REVOKE_CONFIRMATION =
  "Revoke office rollout expansion review? This is audited. Expansion beyond the role allowlist is blocked; existing pilot, dispatcher, and role guardrails remain in effect.";
