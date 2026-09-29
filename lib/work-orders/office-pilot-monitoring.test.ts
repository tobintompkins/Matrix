import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateOfficeRolloutGuard } from "./office-rollout-guard";
import { compareWorkOrderQueues, type WorkOrderCompareRow } from "./office-queue-compare";
import {
  buildManagerOfficeRolloutResolution,
  buildOfficePilotMonitoringView,
  OFFICE_PILOT_REVOKE_CONFIRMATION,
} from "./office-pilot-monitoring";
import { buildOfficePilotStatus } from "./office-pilot-status";

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

function basePilotStatus(overrides: Partial<ReturnType<typeof buildOfficePilotStatus>> = {}) {
  const guard = evaluateOfficeRolloutGuard(
    compareWorkOrderQueues(
      [row({ id: "b1", workOrderNumber: "WO-2026-000001" })],
      [row({ id: "s1", workOrderNumber: "WO-2026-000001" })],
    ),
  );
  const pilot = buildOfficePilotStatus({
    officeFlagEnabled: true,
    profile: {
      userId: "user_pilot",
      email: "pilot@sfx.example",
      displayName: "Pilot Manager",
    },
    guard,
    pilotManager: "pilot@sfx.example",
    signoff: {
      status: "approved",
      action: "OFFICE_SERVER_PILOT_SIGNOFF_APPROVED",
      occurredAt: "2026-09-28T12:00:00.000Z",
      actorId: "user_pilot",
      actorDisplayName: "Pilot Manager",
      message: "Approved for pilot",
    },
    signoffAudits: [],
  });
  return { guard, pilot: { ...pilot, ...overrides } };
}

describe("office pilot monitoring", () => {
  it("shows server effective queue only for the approved named pilot manager", () => {
    const { guard, pilot } = basePilotStatus();
    const rollout = buildManagerOfficeRolloutResolution({
      officeFlagEnabled: true,
      guard,
      pilot,
    });
    const monitoring = buildOfficePilotMonitoringView({ pilot, guard, rollout });

    assert.equal(monitoring.effectiveQueue.source, "server");
    assert.equal(monitoring.effectiveQueue.indicator, "server-active-pilot");
    assert.equal(monitoring.pilotServerQueueEnabled, true);
    assert.equal(monitoring.accessLimitedToNamedManager, true);
    assert.equal(monitoring.latestDecision.status, "approved");
  });

  it("keeps browser fallback for other managers during the one-manager pilot", () => {
    const { guard, pilot } = basePilotStatus({
      isNamedPilotManager: false,
      pilotServerQueueEnabled: false,
    });
    const rollout = buildManagerOfficeRolloutResolution({
      officeFlagEnabled: true,
      guard,
      pilot,
    });
    const monitoring = buildOfficePilotMonitoringView({ pilot, guard, rollout });

    assert.equal(monitoring.effectiveQueue.source, "browser");
    assert.equal(monitoring.effectiveQueue.browserFallbackActive, true);
    assert.equal(monitoring.pilotServerQueueEnabled, false);
  });

  it("surfaces blocked guard summary while staying on browser fallback", () => {
    const guard = evaluateOfficeRolloutGuard(
      compareWorkOrderQueues(
        [row({ id: "b1", workOrderNumber: "WO-2026-000001", status: "NEW" })],
        [row({ id: "s1", workOrderNumber: "WO-2026-000001", status: "ASSIGNED" })],
      ),
    );
    const pilot = buildOfficePilotStatus({
      officeFlagEnabled: true,
      profile: { userId: "user_pilot", email: "pilot@sfx.example", displayName: "Pilot Manager" },
      guard,
      pilotManager: "pilot@sfx.example",
      signoff: {
        status: "approved",
        action: null,
        occurredAt: null,
        actorId: null,
        actorDisplayName: null,
        message: null,
      },
      signoffAudits: [],
    });
    const rollout = buildManagerOfficeRolloutResolution({ officeFlagEnabled: true, guard, pilot });
    const monitoring = buildOfficePilotMonitoringView({ pilot, guard, rollout });

    assert.equal(monitoring.guardSummary.status, "blocked");
    assert.equal(monitoring.effectiveQueue.source, "browser");
    assert.ok(monitoring.guardSummary.reasons.length > 0);
  });

  it("includes a revoke confirmation message for audited rollback", () => {
    assert.ok(OFFICE_PILOT_REVOKE_CONFIRMATION.includes("Revoke"));
    assert.ok(OFFICE_PILOT_REVOKE_CONFIRMATION.includes("browser queue"));
  });
});
