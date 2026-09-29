import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isOfficePilotServerQueueEligible,
  matchesOfficePilotManager,
  officePilotBlockedReasons,
  resolvePilotSignoffStatus,
  OFFICE_PILOT_SIGNOFF_ACTIONS,
} from "./office-pilot";
import { resolveOfficeQueueRollout } from "./office-queue-rollout";

describe("office pilot", () => {
  it("matches pilot manager by email, user id, or display name", () => {
    assert.equal(
      matchesOfficePilotManager(
        { userId: "user_123", email: "manager@sfx.example", displayName: "Pat Manager" },
        "manager@sfx.example",
      ),
      true,
    );
    assert.equal(
      matchesOfficePilotManager(
        { userId: "user_123", email: "manager@sfx.example", displayName: "Pat Manager" },
        "user_123",
      ),
      true,
    );
    assert.equal(
      matchesOfficePilotManager(
        { userId: "user_123", email: "other@sfx.example", displayName: "Pat Manager" },
        "Pat Manager",
      ),
      true,
    );
  });

  it("requires guard, sign-off, and named manager for server queue access", () => {
    assert.equal(
      isOfficePilotServerQueueEligible({
        officeFlagEnabled: true,
        guardReady: true,
        pilotManagerConfigured: true,
        signoffStatus: "approved",
        isNamedPilotManager: true,
      }),
      true,
    );
    assert.equal(
      isOfficePilotServerQueueEligible({
        officeFlagEnabled: true,
        guardReady: true,
        pilotManagerConfigured: true,
        signoffStatus: "none",
        isNamedPilotManager: true,
      }),
      false,
    );
  });

  it("maps audit actions to sign-off status", () => {
    assert.equal(resolvePilotSignoffStatus(OFFICE_PILOT_SIGNOFF_ACTIONS.approve), "approved");
    assert.equal(resolvePilotSignoffStatus(OFFICE_PILOT_SIGNOFF_ACTIONS.revoke), "revoked");
  });

  it("blocks server rollout for non-pilot managers during the one-manager pilot", () => {
    const reasons = officePilotBlockedReasons({
      officeFlagEnabled: true,
      pilotManagerConfigured: true,
      configuredPilotManager: "manager@sfx.example",
      signoffStatus: "approved",
      isNamedPilotManager: false,
      guardReady: true,
      guardBlockedReasons: [],
    });
    assert.ok(reasons.some((reason) => reason.includes("One-manager pilot")));

    const resolution = resolveOfficeQueueRollout({
      officeFlagEnabled: true,
      isManager: true,
      guardCheck: { state: "ready", guardReady: true, blockedReasons: [] },
      configuredPilotManager: "manager@sfx.example",
      pilotCheck: {
        state: "ready",
        pilotManagerConfigured: true,
        signoffStatus: "approved",
        isNamedPilotManager: false,
      },
    });
    assert.equal(resolution.source, "browser");
  });

  it("enables server rollout only for approved pilot manager with clean guard", () => {
    const resolution = resolveOfficeQueueRollout({
      officeFlagEnabled: true,
      isManager: true,
      guardCheck: { state: "ready", guardReady: true, blockedReasons: [] },
      configuredPilotManager: "manager@sfx.example",
      pilotCheck: {
        state: "ready",
        pilotManagerConfigured: true,
        signoffStatus: "approved",
        isNamedPilotManager: true,
      },
    });
    assert.equal(resolution.source, "server");
    assert.equal(resolution.indicator, "server-active-pilot");
  });
});
