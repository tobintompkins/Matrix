import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildMaintenanceQueueRows,
  computeFleetDashboardMetrics,
  computeFleetHealthScore,
  defaultMaintenanceDashboardFilters,
  filterMaintenanceQueue,
  paginateRows,
  sortMaintenanceQueue,
} from "./dashboard";
import {
  buildExportPayload,
  buildMaintenanceCsv,
  filterRowsForExport,
} from "./export";
import { computeFleetMaintenanceSummary } from "./helpers";
import { sampleMaintenanceCompletions, sampleMaintenanceProfiles } from "./data";
import { buildMonthGrid, eventsForDate } from "./scheduling";

describe("fleet health score", () => {
  it("labels Excellent at 95%+", () => {
    const score = computeFleetHealthScore({
      totalPrinters: 20,
      printersCurrent: 19,
      printersDueSoon: 1,
      printersDue: 0,
      printersOverdue: 0,
      printersSetupRequired: 0,
      highest: null,
      lowest: null,
      averageFleetCount: 1,
      totalFleetCopies: 1,
      machinesWithCounts: 20,
      insufficientData: false,
    });
    assert.equal(score.label, "Excellent");
    assert.equal(score.percentage, 95);
  });

  it("labels Critical below 70%", () => {
    const score = computeFleetHealthScore({
      totalPrinters: 10,
      printersCurrent: 3,
      printersDueSoon: 2,
      printersDue: 2,
      printersOverdue: 3,
      printersSetupRequired: 0,
      highest: null,
      lowest: null,
      averageFleetCount: 1,
      totalFleetCopies: 1,
      machinesWithCounts: 10,
      insufficientData: false,
    });
    assert.equal(score.label, "Critical");
    assert.ok(score.percentage < 70);
  });

  it("marks insufficient data when no configured printers", () => {
    const score = computeFleetHealthScore({
      totalPrinters: 5,
      printersCurrent: 0,
      printersDueSoon: 0,
      printersDue: 0,
      printersOverdue: 0,
      printersSetupRequired: 5,
      highest: null,
      lowest: null,
      averageFleetCount: null,
      totalFleetCopies: null,
      machinesWithCounts: 0,
      insufficientData: true,
    });
    assert.equal(score.insufficientData, true);
  });
});

describe("dashboard metrics and queue", () => {
  it("computes live fleet dashboard metrics from sample data", () => {
    const metrics = computeFleetDashboardMetrics(
      sampleMaintenanceProfiles,
      sampleMaintenanceCompletions,
      new Date("2026-07-10"),
    );
    assert.equal(metrics.totalPrinters, sampleMaintenanceProfiles.length);
    assert.ok(metrics.health.percentage >= 0);
    assert.ok(typeof metrics.pmsCompletedThisMonth === "number");
  });

  it("builds queue rows prioritized by overdue first when sorted", () => {
    const rows = buildMaintenanceQueueRows(sampleMaintenanceProfiles);
    const sorted = sortMaintenanceQueue(rows, "priority", "asc");
    assert.ok(sorted.length > 0);
    for (let i = 1; i < sorted.length; i += 1) {
      const rank = { OVERDUE: 0, DUE: 1, DUE_SOON: 2, UNKNOWN: 3, CURRENT: 4 };
      assert.ok(rank[sorted[i - 1].status] <= rank[sorted[i].status]);
    }
  });

  it("filters by status and model", () => {
    const rows = buildMaintenanceQueueRows(sampleMaintenanceProfiles);
    const filters = {
      ...defaultMaintenanceDashboardFilters(),
      status: "OVERDUE" as const,
    };
    const overdue = filterMaintenanceQueue(rows, filters);
    assert.ok(overdue.every((r) => r.status === "OVERDUE"));

    const model = rows[0]?.model;
    if (model) {
      const byModel = filterMaintenanceQueue(rows, {
        ...defaultMaintenanceDashboardFilters(),
        model,
      });
      assert.ok(byModel.every((r) => r.model === model));
    }
  });

  it("paginates queue rows", () => {
    const rows = buildMaintenanceQueueRows(sampleMaintenanceProfiles);
    const page = paginateRows(rows, 1, 5);
    assert.equal(page.items.length, Math.min(5, rows.length));
    assert.equal(page.total, rows.length);
  });
});

describe("calendar helpers", () => {
  it("builds a month grid with full weeks", () => {
    const grid = buildMonthGrid(2026, 6);
    assert.equal(grid.length % 7, 0);
  });

  it("filters schedule events by date", () => {
    const events = [
      {
        id: "1",
        printerId: "MX-GD-001",
        printerName: "A",
        customerName: "C",
        siteName: "S",
        kind: "PM" as const,
        scheduledDate: "2026-07-10",
        technician: "T",
        priority: "NORMAL" as const,
        expectedDurationHours: 2,
        notes: "",
        createdAt: "",
        createdBy: "",
        updatedAt: "",
      },
      {
        id: "2",
        printerId: "MX-GD-002",
        printerName: "B",
        customerName: "C",
        siteName: "S",
        kind: "CLEANING" as const,
        scheduledDate: "2026-07-11",
        technician: "T",
        priority: "HIGH" as const,
        expectedDurationHours: 1,
        notes: "",
        createdAt: "",
        createdBy: "",
        updatedAt: "",
      },
    ];
    assert.equal(eventsForDate(events, "2026-07-10").length, 1);
  });
});

describe("export generation", () => {
  it("builds CSV with headers", () => {
    const rows = buildMaintenanceQueueRows(sampleMaintenanceProfiles).slice(
      0,
      3,
    );
    const csv = buildMaintenanceCsv(rows);
    assert.match(csv, /^Customer,Site,Printer/);
    assert.ok(csv.split("\n").length >= 2);
  });

  it("filters selected printers for export", () => {
    const rows = buildMaintenanceQueueRows(sampleMaintenanceProfiles);
    const selected = filterRowsForExport(rows, {
      scope: "selected",
      rows,
      selectedIds: [rows[0].printerId],
    });
    assert.equal(selected.length, 1);
  });

  it("builds export payload for excel", () => {
    const rows = buildMaintenanceQueueRows(sampleMaintenanceProfiles);
    const payload = buildExportPayload({
      format: "excel",
      scope: "entire_fleet",
      rows,
      exportedBy: "tester",
    });
    assert.match(payload.filename, /\.xls$/);
    assert.match(payload.content, /Workbook/);
    assert.equal(payload.audit.action, "EXPORT_GENERATED");
  });
});

describe("status calculations remain consistent", () => {
  it("fleet summary matches queue status counts", () => {
    const summary = computeFleetMaintenanceSummary(sampleMaintenanceProfiles);
    const rows = buildMaintenanceQueueRows(sampleMaintenanceProfiles);
    assert.equal(
      rows.filter((r) => r.status === "CURRENT").length,
      summary.printersCurrent,
    );
    assert.equal(
      rows.filter((r) => r.status === "OVERDUE").length,
      summary.printersOverdue,
    );
  });
});
