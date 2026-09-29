import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateOfficeRolloutGuard } from "./office-rollout-guard";
import { compareWorkOrderQueues, type WorkOrderCompareRow } from "./office-queue-compare";
import {
  getOfficeDispatcherAllowlist,
  isOfficeDispatcherServerQueueEligible,
  matchesOfficeDispatcherAllowlist,
  officeDispatcherBlockedReasons,
} from "./office-dispatcher-group";
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

describe("office dispatcher group rollout", () => {
  it("parses dispatcher allowlist from env", () => {
    const previous = process.env.MATRIX_SERVER_OFFICE_DISPATCHER_ALLOWLIST;
    process.env.MATRIX_SERVER_OFFICE_DISPATCHER_ALLOWLIST = " dispatch1@sfx.example , dispatch2@sfx.example ";
    assert.deepEqual(getOfficeDispatcherAllowlist(), [
      "dispatch1@sfx.example",
      "dispatch2@sfx.example",
    ]);
    if (previous === undefined) delete process.env.MATRIX_SERVER_OFFICE_DISPATCHER_ALLOWLIST;
    else process.env.MATRIX_SERVER_OFFICE_DISPATCHER_ALLOWLIST = previous;
  });

  it("matches allowlisted dispatcher identities", () => {
    assert.equal(
      matchesOfficeDispatcherAllowlist(
        { userId: "user_d1", email: "dispatch1@sfx.example", displayName: "Dispatch One" },
        ["dispatch1@sfx.example"],
      ),
      true,
    );
  });

  it("denies server access outside the approved allowlist", () => {
    assert.equal(
      isOfficeDispatcherServerQueueEligible({
        officeFlagEnabled: true,
        guardReady: true,
        pilotSignoffApproved: true,
        groupSignoffStatus: "approved",
        allowlistConfigured: true,
        isOnAllowlist: false,
      }),
      false,
    );
    const reasons = officeDispatcherBlockedReasons({
      officeFlagEnabled: true,
      guardReady: true,
      guardBlockedReasons: [],
      pilotSignoffApproved: true,
      allowlistConfigured: true,
      groupSignoffStatus: "approved",
      isOnAllowlist: false,
    });
    assert.ok(reasons.some((reason) => reason.includes("outside the approved dispatcher allowlist")));
  });

  it("enables server queue for allowlisted users after pilot and group approval", () => {
    const guard = evaluateOfficeRolloutGuard(
      compareWorkOrderQueues(
        [row({ id: "b1", workOrderNumber: "WO-2026-000001" })],
        [row({ id: "s1", workOrderNumber: "WO-2026-000001" })],
      ),
    );
    const resolution = resolveOfficeQueueRollout({
      officeFlagEnabled: true,
      isManager: true,
      guardCheck: { state: "ready", guardReady: guard.readyToEnableOfficeFlag, blockedReasons: [] },
      configuredPilotManager: "pilot@sfx.example",
      pilotCheck: {
        state: "ready",
        pilotManagerConfigured: true,
        signoffStatus: "approved",
        isNamedPilotManager: false,
      },
      dispatcherCheck: {
        state: "ready",
        allowlistConfigured: true,
        groupSignoffStatus: "approved",
        isOnAllowlist: true,
        pilotSignoffApproved: true,
      },
    });
    assert.equal(resolution.source, "server");
    assert.equal(resolution.indicator, "server-active-dispatcher");
  });

  it("requires approved pilot sign-off before dispatcher group access", () => {
    const reasons = officeDispatcherBlockedReasons({
      officeFlagEnabled: true,
      guardReady: true,
      guardBlockedReasons: [],
      pilotSignoffApproved: false,
      allowlistConfigured: true,
      groupSignoffStatus: "approved",
      isOnAllowlist: true,
    });
    assert.ok(reasons.some((reason) => reason.includes("Named manager pilot sign-off")));
  });
});
