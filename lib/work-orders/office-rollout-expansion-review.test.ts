import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateOfficeRolloutGuard } from "./office-rollout-guard";
import { compareWorkOrderQueues, type WorkOrderCompareRow } from "./office-queue-compare";
import {
  buildExpansionReviewReadiness,
  isOfficeExpansionBeyondAllowlistEligible,
  resolveExpansionReviewStatus,
  OFFICE_EXPANSION_REVIEW_ACTIONS,
} from "./office-rollout-expansion-review";
import { resolveOfficeQueueRollout } from "./office-queue-rollout";

function row(partial: Partial<WorkOrderCompareRow> & Pick<WorkOrderCompareRow, "id" | "workOrderNumber">): WorkOrderCompareRow {
  return {
    legacyWorkOrderId: null,
    title: "Test",
    assignedTechnician: "",
    scheduledStart: null,
    scheduledEnd: null,
    status: "NEW",
    updatedAt: "2026-09-28T12:00:00.000Z",
    ...partial,
  };
}

describe("office rollout expansion review", () => {
  it("maps audit actions to review status", () => {
    assert.equal(resolveExpansionReviewStatus(OFFICE_EXPANSION_REVIEW_ACTIONS.approve), "approved");
    assert.equal(resolveExpansionReviewStatus(OFFICE_EXPANSION_REVIEW_ACTIONS.hold), "held");
    assert.equal(resolveExpansionReviewStatus(OFFICE_EXPANSION_REVIEW_ACTIONS.revoke), "revoked");
    assert.equal(resolveExpansionReviewStatus(undefined), "none");
  });

  it("requires prior stage sign-offs before manager review approval", () => {
    const guard = evaluateOfficeRolloutGuard(
      compareWorkOrderQueues(
        [row({ id: "b1", workOrderNumber: "WO-2026-000001" })],
        [row({ id: "s1", workOrderNumber: "WO-2026-000001" })],
      ),
    );
    const blocked = buildExpansionReviewReadiness({
      guard,
      pilotSignoffStatus: "none",
      dispatcherSignoffStatus: "approved",
      roleExpansionSignoffStatus: "approved",
      roleAllowlistConfigured: true,
    });
    assert.equal(blocked.ready, false);
    assert.ok(blocked.blockers.some((reason) => reason.includes("pilot")));

    const ready = buildExpansionReviewReadiness({
      guard,
      pilotSignoffStatus: "approved",
      dispatcherSignoffStatus: "approved",
      roleExpansionSignoffStatus: "approved",
      roleAllowlistConfigured: true,
    });
    assert.equal(ready.ready, true);
  });

  it("grants beyond-allowlist eligibility only for managers without other rollout paths", () => {
    assert.equal(
      isOfficeExpansionBeyondAllowlistEligible({
        officeFlagEnabled: true,
        guardReady: true,
        pilotSignoffApproved: true,
        dispatcherSignoffApproved: true,
        roleExpansionSignoffApproved: true,
        expansionReviewApproved: true,
        expansionBeyondRolesFlagEnabled: true,
        isManager: true,
        isOnRoleAllowlist: false,
        isNamedPilotManager: false,
        isOnDispatcherAllowlist: false,
      }),
      true,
    );
    assert.equal(
      isOfficeExpansionBeyondAllowlistEligible({
        officeFlagEnabled: true,
        guardReady: true,
        pilotSignoffApproved: true,
        dispatcherSignoffApproved: true,
        roleExpansionSignoffApproved: true,
        expansionReviewApproved: false,
        expansionBeyondRolesFlagEnabled: true,
        isManager: true,
        isOnRoleAllowlist: false,
        isNamedPilotManager: false,
        isOnDispatcherAllowlist: false,
      }),
      false,
    );
  });

  it("activates expansion-review server path when approved and flag enabled", () => {
    const previous = process.env.MATRIX_SERVER_OFFICE_EXPANSION_BEYOND_ROLES;
    process.env.MATRIX_SERVER_OFFICE_EXPANSION_BEYOND_ROLES = "true";

    const resolution = resolveOfficeQueueRollout({
      officeFlagEnabled: true,
      isManager: true,
      userRole: "OPERATIONS_MANAGER",
      guardCheck: { state: "ready", guardReady: true, blockedReasons: [] },
      pilotCheck: {
        state: "ready",
        pilotManagerConfigured: true,
        signoffStatus: "approved",
        isNamedPilotManager: false,
      },
      dispatcherCheck: { state: "not-required" },
      roleExpansionCheck: {
        state: "ready",
        roleAllowlistConfigured: true,
        roleSignoffStatus: "approved",
        isApprovedRole: false,
        pilotSignoffApproved: true,
        dispatcherSignoffApproved: true,
      },
      expansionReviewCheck: {
        state: "ready",
        reviewStatus: "approved",
        eligibleBeyondAllowlist: true,
      },
    });

    assert.equal(resolution.source, "server");
    assert.equal(resolution.indicator, "server-active-expansion-review");

    if (previous === undefined) delete process.env.MATRIX_SERVER_OFFICE_EXPANSION_BEYOND_ROLES;
    else process.env.MATRIX_SERVER_OFFICE_EXPANSION_BEYOND_ROLES = previous;
  });
});
