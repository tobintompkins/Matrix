import type { MatrixRole, MatrixUserProfile } from "@/lib/auth/types";
import {
  getOfficeDispatcherAllowlist,
  isOfficeDispatcherServerQueueEligible,
  matchesOfficeDispatcherAllowlist,
  type OfficeDispatcherRolloutCheck,
} from "./office-dispatcher-group";
import type { OfficeDispatcherSignoffRecord } from "./office-dispatcher-signoff";
import type { OfficeRolloutGuardResult } from "./office-rollout-guard";
import {
  getConfiguredOfficePilotManager,
  isOfficePilotServerQueueEligible,
  matchesOfficePilotManager,
  type OfficePilotSignoffStatus,
} from "./office-pilot";
import type { OfficePilotSignoffRecord } from "./office-pilot-signoff";
import {
  describeEffectiveQueueReason,
  getOfficeRoleAllowlist,
  isOfficeRoleExpansionServerQueueEligible,
  isUserRoleApproved,
  type OfficeRoleExpansionRolloutCheck,
} from "./office-role-expansion";
import type { OfficeRoleExpansionSignoffRecord } from "./office-role-expansion-signoff";
import {
  isOfficeExpansionBeyondAllowlistEligible,
  isOfficeExpansionBeyondRoleAllowlistEnabled,
  type OfficeExpansionReviewStatus,
} from "./office-rollout-expansion-review";
import type { OfficeExpansionReviewRecord } from "./office-rollout-expansion-review-signoff";
import {
  resolveOfficeQueueRollout,
  type OfficeExpansionReviewRolloutCheck,
  type OfficeQueueRolloutResolution,
} from "./office-queue-rollout";
import type { OfficePilotRolloutCheck } from "./office-pilot";

export type OfficeUserQueueAccessMode =
  | "browser-default"
  | "browser-fallback"
  | "server-pilot-manager"
  | "server-dispatcher-allowlist"
  | "server-role-allowlist"
  | "server-expansion-beyond-allowlist";

export type OfficeRolloutStatus = {
  officeFlagEnabled: boolean;
  guard: OfficeRolloutGuardResult;
  pilotManager: string | null;
  pilotSignoffStatus: OfficePilotSignoffStatus;
  dispatcherAllowlist: string[];
  dispatcherGroupSignoffStatus: OfficePilotSignoffStatus;
  roleAllowlist: MatrixRole[];
  roleExpansionSignoffStatus: OfficePilotSignoffStatus;
  userRole: MatrixRole;
  isNamedPilotManager: boolean;
  isOnDispatcherAllowlist: boolean;
  isApprovedRole: boolean;
  pilotServerQueueEnabled: boolean;
  dispatcherServerQueueEnabled: boolean;
  roleServerQueueEnabled: boolean;
  effectiveRollout: OfficeQueueRolloutResolution;
  userAccessMode: OfficeUserQueueAccessMode;
  effectiveQueueReason: string;
};

export function buildOfficePilotRolloutCheckFromSignoff(input: {
  officeFlagEnabled: boolean;
  pilotManagerConfigured: boolean;
  signoffStatus: OfficePilotSignoffStatus;
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

export function buildOfficeDispatcherRolloutCheck(input: {
  officeFlagEnabled: boolean;
  allowlistConfigured: boolean;
  groupSignoffStatus: OfficePilotSignoffStatus;
  isOnAllowlist: boolean;
  pilotSignoffApproved: boolean;
  statusLoaded: boolean;
}): OfficeDispatcherRolloutCheck {
  if (!input.officeFlagEnabled || !input.allowlistConfigured) {
    return { state: "not-required" };
  }
  if (!input.statusLoaded) return { state: "pending" };
  return {
    state: "ready",
    allowlistConfigured: input.allowlistConfigured,
    groupSignoffStatus: input.groupSignoffStatus,
    isOnAllowlist: input.isOnAllowlist,
    pilotSignoffApproved: input.pilotSignoffApproved,
  };
}

export function buildOfficeRoleExpansionRolloutCheck(input: {
  officeFlagEnabled: boolean;
  roleAllowlistConfigured: boolean;
  roleSignoffStatus: OfficePilotSignoffStatus;
  isApprovedRole: boolean;
  pilotSignoffApproved: boolean;
  dispatcherSignoffApproved: boolean;
  statusLoaded: boolean;
}): OfficeRoleExpansionRolloutCheck {
  if (!input.officeFlagEnabled || !input.roleAllowlistConfigured) {
    return { state: "not-required" };
  }
  if (!input.statusLoaded) return { state: "pending" };
  return {
    state: "ready",
    roleAllowlistConfigured: input.roleAllowlistConfigured,
    roleSignoffStatus: input.roleSignoffStatus,
    isApprovedRole: input.isApprovedRole,
    pilotSignoffApproved: input.pilotSignoffApproved,
    dispatcherSignoffApproved: input.dispatcherSignoffApproved,
  };
}

export function buildOfficeExpansionReviewRolloutCheck(input: {
  officeFlagEnabled: boolean;
  roleAllowlistConfigured: boolean;
  pilotSignoffApproved: boolean;
  dispatcherSignoffApproved: boolean;
  roleExpansionSignoffApproved: boolean;
  reviewStatus: OfficeExpansionReviewStatus;
  isManager: boolean;
  isNamedPilotManager: boolean;
  isOnDispatcherAllowlist: boolean;
  isOnRoleAllowlist: boolean;
  guardReady: boolean;
  statusLoaded: boolean;
}): OfficeExpansionReviewRolloutCheck {
  if (
    !input.officeFlagEnabled ||
    !isOfficeExpansionBeyondRoleAllowlistEnabled() ||
    !input.roleAllowlistConfigured
  ) {
    return { state: "not-required" };
  }
  if (!input.statusLoaded) {
    return { state: "not-required" };
  }
  const eligibleBeyondAllowlist = isOfficeExpansionBeyondAllowlistEligible({
    officeFlagEnabled: input.officeFlagEnabled,
    guardReady: input.guardReady,
    pilotSignoffApproved: input.pilotSignoffApproved,
    dispatcherSignoffApproved: input.dispatcherSignoffApproved,
    roleExpansionSignoffApproved: input.roleExpansionSignoffApproved,
    expansionReviewApproved: input.reviewStatus === "approved",
    expansionBeyondRolesFlagEnabled: true,
    isManager: input.isManager,
    isOnRoleAllowlist: input.isOnRoleAllowlist,
    isNamedPilotManager: input.isNamedPilotManager,
    isOnDispatcherAllowlist: input.isOnDispatcherAllowlist,
  });
  return {
    state: "ready",
    reviewStatus: input.reviewStatus,
    eligibleBeyondAllowlist,
  };
}

export function resolveUserAccessMode(input: {
  rollout: OfficeQueueRolloutResolution;
  pilotServerQueueEnabled: boolean;
  dispatcherServerQueueEnabled: boolean;
  roleServerQueueEnabled: boolean;
}): OfficeUserQueueAccessMode {
  if (input.rollout.source !== "server") {
    return input.rollout.indicator === "browser-default" ? "browser-default" : "browser-fallback";
  }
  if (input.rollout.indicator === "server-active-expansion-review") {
    return "server-expansion-beyond-allowlist";
  }
  if (input.roleServerQueueEnabled) return "server-role-allowlist";
  if (input.dispatcherServerQueueEnabled) return "server-dispatcher-allowlist";
  if (input.pilotServerQueueEnabled) return "server-pilot-manager";
  return "browser-fallback";
}

export function buildOfficeRolloutStatus(input: {
  officeFlagEnabled: boolean;
  profile: Pick<MatrixUserProfile, "userId" | "email" | "displayName" | "role">;
  guard: OfficeRolloutGuardResult;
  pilotSignoff: OfficePilotSignoffRecord;
  dispatcherSignoff: OfficeDispatcherSignoffRecord;
  roleExpansionSignoff: OfficeRoleExpansionSignoffRecord;
  expansionReview?: OfficeExpansionReviewRecord;
  dispatcherAllowlist?: string[];
  roleAllowlist?: MatrixRole[];
}): OfficeRolloutStatus {
  const pilotManager = getConfiguredOfficePilotManager();
  const pilotManagerConfigured = Boolean(pilotManager);
  const isNamedPilotManager = pilotManager
    ? matchesOfficePilotManager(input.profile, pilotManager)
    : false;
  const dispatcherAllowlist = input.dispatcherAllowlist ?? getOfficeDispatcherAllowlist();
  const dispatcherAllowlistConfigured = dispatcherAllowlist.length > 0;
  const isOnDispatcherAllowlist = matchesOfficeDispatcherAllowlist(input.profile, dispatcherAllowlist);
  const roleAllowlist = input.roleAllowlist ?? getOfficeRoleAllowlist();
  const roleAllowlistConfigured = roleAllowlist.length > 0;
  const isApprovedRole = isUserRoleApproved(input.profile.role, roleAllowlist);
  const pilotSignoffApproved = input.pilotSignoff.status === "approved";
  const dispatcherSignoffApproved = input.dispatcherSignoff.status === "approved";

  const pilotServerQueueEnabled = isOfficePilotServerQueueEligible({
    officeFlagEnabled: input.officeFlagEnabled,
    guardReady: input.guard.readyToEnableOfficeFlag,
    pilotManagerConfigured,
    signoffStatus: input.pilotSignoff.status,
    isNamedPilotManager,
  });

  const dispatcherServerQueueEnabled = isOfficeDispatcherServerQueueEligible({
    officeFlagEnabled: input.officeFlagEnabled,
    guardReady: input.guard.readyToEnableOfficeFlag,
    pilotSignoffApproved,
    groupSignoffStatus: input.dispatcherSignoff.status,
    allowlistConfigured: dispatcherAllowlistConfigured,
    isOnAllowlist: isOnDispatcherAllowlist,
  });

  const roleServerQueueEnabled = isOfficeRoleExpansionServerQueueEligible({
    officeFlagEnabled: input.officeFlagEnabled,
    guardReady: input.guard.readyToEnableOfficeFlag,
    pilotSignoffApproved,
    dispatcherSignoffApproved,
    roleSignoffStatus: input.roleExpansionSignoff.status,
    roleAllowlistConfigured,
    isApprovedRole,
  });

  const isManager = true; // callers pass profile for permission-checked routes

  const pilotCheck = buildOfficePilotRolloutCheckFromSignoff({
    officeFlagEnabled: input.officeFlagEnabled,
    pilotManagerConfigured,
    signoffStatus: input.pilotSignoff.status,
    isNamedPilotManager,
    statusLoaded: true,
  });

  const dispatcherCheck = buildOfficeDispatcherRolloutCheck({
    officeFlagEnabled: input.officeFlagEnabled,
    allowlistConfigured: dispatcherAllowlistConfigured,
    groupSignoffStatus: input.dispatcherSignoff.status,
    isOnAllowlist: isOnDispatcherAllowlist,
    pilotSignoffApproved,
    statusLoaded: true,
  });

  const roleExpansionCheck = buildOfficeRoleExpansionRolloutCheck({
    officeFlagEnabled: input.officeFlagEnabled,
    roleAllowlistConfigured,
    roleSignoffStatus: input.roleExpansionSignoff.status,
    isApprovedRole,
    pilotSignoffApproved,
    dispatcherSignoffApproved,
    statusLoaded: true,
  });

  const expansionReview = input.expansionReview ?? { status: "none" as const };
  const roleExpansionSignoffApproved = input.roleExpansionSignoff.status === "approved";
  const expansionReviewCheck = buildOfficeExpansionReviewRolloutCheck({
    officeFlagEnabled: input.officeFlagEnabled,
    roleAllowlistConfigured,
    pilotSignoffApproved,
    dispatcherSignoffApproved,
    roleExpansionSignoffApproved,
    reviewStatus: expansionReview.status,
    isManager,
    isNamedPilotManager,
    isOnDispatcherAllowlist,
    isOnRoleAllowlist: isApprovedRole,
    guardReady: input.guard.readyToEnableOfficeFlag,
    statusLoaded: true,
  });

  const effectiveRollout = resolveOfficeQueueRollout({
    officeFlagEnabled: input.officeFlagEnabled,
    isManager,
    userRole: input.profile.role,
    guardCheck: {
      state: "ready",
      guardReady: input.guard.readyToEnableOfficeFlag,
      blockedReasons: input.guard.readyToEnableOfficeFlag ? [] : input.guard.reasons,
    },
    pilotCheck,
    dispatcherCheck,
    roleExpansionCheck,
    expansionReviewCheck,
    configuredPilotManager: pilotManager,
  });

  const userAccessMode = resolveUserAccessMode({
    rollout: effectiveRollout,
    pilotServerQueueEnabled,
    dispatcherServerQueueEnabled,
    roleServerQueueEnabled,
  });

  const effectiveQueueReason = describeEffectiveQueueReason({
    userAccessMode,
    rolloutBlockedReasons: effectiveRollout.blockedReasons,
  });

  return {
    officeFlagEnabled: input.officeFlagEnabled,
    guard: input.guard,
    pilotManager,
    pilotSignoffStatus: input.pilotSignoff.status,
    dispatcherAllowlist,
    dispatcherGroupSignoffStatus: input.dispatcherSignoff.status,
    roleAllowlist,
    roleExpansionSignoffStatus: input.roleExpansionSignoff.status,
    userRole: input.profile.role,
    isNamedPilotManager,
    isOnDispatcherAllowlist,
    isApprovedRole,
    pilotServerQueueEnabled,
    dispatcherServerQueueEnabled,
    roleServerQueueEnabled,
    effectiveRollout,
    userAccessMode,
    effectiveQueueReason,
  };
}

/** Effective queue for the signed-in user (managers and approved-role participants). */
export function buildOfficeRolloutStatusForUser(input: {
  officeFlagEnabled: boolean;
  profile: MatrixUserProfile;
  guard: OfficeRolloutGuardResult;
  pilotSignoff: OfficePilotSignoffRecord;
  dispatcherSignoff: OfficeDispatcherSignoffRecord;
  roleExpansionSignoff: OfficeRoleExpansionSignoffRecord;
  expansionReview?: OfficeExpansionReviewRecord;
  dispatcherAllowlist?: string[];
  roleAllowlist?: MatrixRole[];
  isManager: boolean;
}): OfficeRolloutStatus {
  const base = buildOfficeRolloutStatus({
    officeFlagEnabled: input.officeFlagEnabled,
    profile: input.profile,
    guard: input.guard,
    pilotSignoff: input.pilotSignoff,
    dispatcherSignoff: input.dispatcherSignoff,
    roleExpansionSignoff: input.roleExpansionSignoff,
    expansionReview: input.expansionReview,
    dispatcherAllowlist: input.dispatcherAllowlist,
    roleAllowlist: input.roleAllowlist,
  });

  const pilotManager = getConfiguredOfficePilotManager();
  const pilotManagerConfigured = Boolean(pilotManager);
  const isNamedPilotManager = pilotManager
    ? matchesOfficePilotManager(input.profile, pilotManager)
    : false;
  const dispatcherAllowlist = input.dispatcherAllowlist ?? getOfficeDispatcherAllowlist();
  const roleAllowlist = input.roleAllowlist ?? getOfficeRoleAllowlist();
  const pilotSignoffApproved = input.pilotSignoff.status === "approved";
  const dispatcherSignoffApproved = input.dispatcherSignoff.status === "approved";

  const pilotCheck = buildOfficePilotRolloutCheckFromSignoff({
    officeFlagEnabled: input.officeFlagEnabled,
    pilotManagerConfigured,
    signoffStatus: input.pilotSignoff.status,
    isNamedPilotManager,
    statusLoaded: true,
  });

  const dispatcherCheck = buildOfficeDispatcherRolloutCheck({
    officeFlagEnabled: input.officeFlagEnabled,
    allowlistConfigured: dispatcherAllowlist.length > 0,
    groupSignoffStatus: input.dispatcherSignoff.status,
    isOnAllowlist: matchesOfficeDispatcherAllowlist(input.profile, dispatcherAllowlist),
    pilotSignoffApproved,
    statusLoaded: true,
  });

  const roleExpansionCheck = buildOfficeRoleExpansionRolloutCheck({
    officeFlagEnabled: input.officeFlagEnabled,
    roleAllowlistConfigured: roleAllowlist.length > 0,
    roleSignoffStatus: input.roleExpansionSignoff.status,
    isApprovedRole: isUserRoleApproved(input.profile.role, roleAllowlist),
    pilotSignoffApproved,
    dispatcherSignoffApproved,
    statusLoaded: true,
  });

  const expansionReview = input.expansionReview ?? { status: "none" as const };
  const roleExpansionSignoffApproved = input.roleExpansionSignoff.status === "approved";
  const expansionReviewCheck = buildOfficeExpansionReviewRolloutCheck({
    officeFlagEnabled: input.officeFlagEnabled,
    roleAllowlistConfigured: roleAllowlist.length > 0,
    pilotSignoffApproved,
    dispatcherSignoffApproved,
    roleExpansionSignoffApproved,
    reviewStatus: expansionReview.status,
    isManager: input.isManager,
    isNamedPilotManager,
    isOnDispatcherAllowlist: matchesOfficeDispatcherAllowlist(input.profile, dispatcherAllowlist),
    isOnRoleAllowlist: isUserRoleApproved(input.profile.role, roleAllowlist),
    guardReady: input.guard.readyToEnableOfficeFlag,
    statusLoaded: true,
  });

  const effectiveRollout = resolveOfficeQueueRollout({
    officeFlagEnabled: input.officeFlagEnabled,
    isManager: input.isManager,
    userRole: input.profile.role,
    guardCheck: {
      state: "ready",
      guardReady: input.guard.readyToEnableOfficeFlag,
      blockedReasons: input.guard.readyToEnableOfficeFlag ? [] : input.guard.reasons,
    },
    pilotCheck,
    dispatcherCheck,
    roleExpansionCheck,
    expansionReviewCheck,
    configuredPilotManager: pilotManager,
  });

  const userAccessMode = resolveUserAccessMode({
    rollout: effectiveRollout,
    pilotServerQueueEnabled: base.pilotServerQueueEnabled,
    dispatcherServerQueueEnabled: base.dispatcherServerQueueEnabled,
    roleServerQueueEnabled: base.roleServerQueueEnabled,
  });

  return {
    ...base,
    effectiveRollout,
    userAccessMode,
    effectiveQueueReason: describeEffectiveQueueReason({
      userAccessMode,
      rolloutBlockedReasons: effectiveRollout.blockedReasons,
    }),
  };
}
