import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateOfficeRolloutGuard } from "./office-rollout-guard";
import { compareWorkOrderQueues, type WorkOrderCompareRow } from "./office-queue-compare";
import {
  getOfficeRoleAllowlist,
  isOfficeRoleExpansionServerQueueEligible,
  isUserRoleApproved,
  officeRoleExpansionBlockedReasons,
} from "./office-role-expansion";
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

describe("office role expansion", () => {
  it("parses Matrix role allowlist from env", () => {
    const previous = process.env.MATRIX_SERVER_OFFICE_ROLE_ALLOWLIST;
    process.env.MATRIX_SERVER_OFFICE_ROLE_ALLOWLIST = " SERVICE_MANAGER , OPERATIONS_MANAGER , INVALID ";
    assert.deepEqual(getOfficeRoleAllowlist(), ["SERVICE_MANAGER", "OPERATIONS_MANAGER"]);
    if (previous === undefined) delete process.env.MATRIX_SERVER_OFFICE_ROLE_ALLOWLIST;
    else process.env.MATRIX_SERVER_OFFICE_ROLE_ALLOWLIST = previous;
  });

  it("requires pilot and dispatcher guardrails before role server access", () => {
    assert.equal(
      isOfficeRoleExpansionServerQueueEligible({
        officeFlagEnabled: true,
        guardReady: true,
        pilotSignoffApproved: false,
        dispatcherSignoffApproved: true,
        roleSignoffStatus: "approved",
        roleAllowlistConfigured: true,
        isApprovedRole: true,
      }),
      false,
    );
  });

  it("denies unapproved roles while preserving browser fallback reasons", () => {
    const reasons = officeRoleExpansionBlockedReasons({
      officeFlagEnabled: true,
      guardReady: true,
      guardBlockedReasons: [],
      pilotSignoffApproved: true,
      dispatcherSignoffApproved: true,
      roleAllowlistConfigured: true,
      roleSignoffStatus: "approved",
      isApprovedRole: false,
      userRole: "FIELD_TECHNICIAN",
    });
    assert.ok(reasons.some((reason) => reason.includes("FIELD_TECHNICIAN")));
    assert.ok(isUserRoleApproved("SERVICE_MANAGER", ["SERVICE_MANAGER"]));
  });

  it("enables server queue for approved roles after guard and sign-offs", () => {
    const guard = evaluateOfficeRolloutGuard(
      compareWorkOrderQueues(
        [row({ id: "b1", workOrderNumber: "WO-2026-000001" })],
        [row({ id: "s1", workOrderNumber: "WO-2026-000001" })],
      ),
    );
    const resolution = resolveOfficeQueueRollout({
      officeFlagEnabled: true,
      isManager: false,
      userRole: "SERVICE_MANAGER",
      guardCheck: { state: "ready", guardReady: guard.readyToEnableOfficeFlag, blockedReasons: [] },
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
        isApprovedRole: true,
        pilotSignoffApproved: true,
        dispatcherSignoffApproved: true,
      },
    });
    assert.equal(resolution.source, "server");
    assert.equal(resolution.indicator, "server-active-role");
  });
});
