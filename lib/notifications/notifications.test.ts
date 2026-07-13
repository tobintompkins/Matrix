import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sampleMaintenanceProfiles } from "@/lib/maintenance/data";
import { hasMatrixPermission } from "@/lib/auth/permissions";
import {
  buildMaintenancePredictions,
  computePrinterHealthIndicators,
  filterNotifications,
  generateMaintenanceReminders,
  groupVisitsByCustomerSite,
  buildTechnicianTaskList,
  predictionConfidence,
  DEFAULT_REMINDER_THRESHOLDS,
  defaultNotificationFilters,
  type MatrixNotification,
} from "./index";

describe("reminder generation", () => {
  it("creates typed reminders for due/overdue printers", () => {
    const reminders = generateMaintenanceReminders(
      sampleMaintenanceProfiles,
      DEFAULT_REMINDER_THRESHOLDS,
      new Date("2026-07-10"),
    );
    assert.ok(reminders.length > 0);
    assert.ok(
      reminders.every((r) =>
        [
          "PM_DUE_SOON",
          "PM_DUE",
          "PM_OVERDUE",
          "CLEANING_DUE",
          "JOINT_UNIT_DUE",
          "DTF_PM_DUE",
        ].includes(r.type),
      ),
    );
    assert.ok(reminders.every((r) => r.title && r.message && r.priority));
  });
});

describe("prediction calculations", () => {
  it("returns confidence levels from history averages", () => {
    assert.equal(
      predictionConfidence({
        hasNextDue: true,
        monthlyVolume: 100000,
        historyPoints: 4,
        sampleDays: 60,
      }),
      "High",
    );
    assert.equal(
      predictionConfidence({
        hasNextDue: false,
        monthlyVolume: null,
        historyPoints: 0,
        sampleDays: 0,
      }),
      "Low",
    );
  });

  it("builds predictions for each maintenance kind", () => {
    const profile = sampleMaintenanceProfiles[0];
    const predictions = buildMaintenancePredictions(profile, [], new Date("2026-07-10"));
    assert.equal(predictions.length, 4);
    assert.ok(predictions.every((p) => p.label && p.confidence));
  });
});

describe("notification filtering", () => {
  const sample: MatrixNotification[] = [
    {
      id: "1",
      type: "PM_OVERDUE",
      title: "A",
      message: "m",
      printerId: "MX-GD-001",
      printerName: "A",
      customerName: "SFX / MPX",
      userIds: ["u"],
      createdAt: "2026-07-10T10:00:00.000Z",
      readAt: null,
      priority: "URGENT",
      relatedRecordType: "printer",
      relatedRecordId: "MX-GD-001",
    },
    {
      id: "2",
      type: "CLEANING_DUE",
      title: "B",
      message: "m",
      printerId: "MX-GD-002",
      printerName: "B",
      customerName: "Other",
      userIds: ["u"],
      createdAt: "2026-07-09T10:00:00.000Z",
      readAt: "2026-07-09T12:00:00.000Z",
      priority: "NORMAL",
      relatedRecordType: "printer",
      relatedRecordId: "MX-GD-002",
    },
  ];

  it("filters unread and priority", () => {
    const unread = filterNotifications(sample, {
      ...defaultNotificationFilters(),
      unreadOnly: true,
    });
    assert.equal(unread.length, 1);
    assert.equal(unread[0].id, "1");

    const urgent = filterNotifications(sample, {
      ...defaultNotificationFilters(),
      priority: "URGENT",
    });
    assert.equal(urgent.length, 1);
  });

  it("filters by customer and type", () => {
    const byCustomer = filterNotifications(sample, {
      ...defaultNotificationFilters(),
      customer: "SFX / MPX",
    });
    assert.equal(byCustomer.length, 1);

    const byType = filterNotifications(sample, {
      ...defaultNotificationFilters(),
      maintenanceType: "CLEANING_DUE",
    });
    assert.equal(byType.length, 1);
  });
});

describe("health score calculations", () => {
  it("computes overall health band for a profile", () => {
    const health = computePrinterHealthIndicators(
      sampleMaintenanceProfiles[0],
      [],
    );
    assert.ok(health.overallHealthScore >= 0);
    assert.ok(health.overallHealthScore <= 100);
    assert.ok(
      ["Excellent", "Good", "Fair", "Poor"].includes(health.band),
    );
  });
});

describe("visit grouping", () => {
  it("groups multiple open tasks at the same site", () => {
    const tasks = buildTechnicianTaskList(sampleMaintenanceProfiles);
    const groups = groupVisitsByCustomerSite(tasks);
    assert.ok(Array.isArray(groups));
    for (const g of groups) {
      assert.ok(g.printerNames.length >= 1);
      assert.ok(g.savingsNote.includes("Combine"));
    }
  });
});

describe("notification permissions", () => {
  it("grants view notifications to technicians", () => {
    assert.equal(
      hasMatrixPermission("FIELD_TECHNICIAN", "VIEW_NOTIFICATIONS"),
      true,
    );
    assert.equal(
      hasMatrixPermission("FIELD_TECHNICIAN", "MANAGE_NOTIFICATION_PREFERENCES"),
      true,
    );
    assert.equal(
      hasMatrixPermission("FIELD_TECHNICIAN", "EDIT_REMINDER_THRESHOLDS"),
      false,
    );
    assert.equal(
      hasMatrixPermission("SERVICE_MANAGER", "EDIT_REMINDER_THRESHOLDS"),
      true,
    );
  });
});
