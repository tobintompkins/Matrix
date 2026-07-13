import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hasMatrixPermission } from "@/lib/auth/permissions";
import { buildWorkOrderFromInput, sampleWorkOrders } from "./data";
import {
  computeWorkOrderMetrics,
  defaultWorkOrderFilters,
  filterWorkOrders,
  nextWorkOrderNumber,
  sortWorkOrders,
  validateCreateWorkOrderInput,
} from "./helpers";
import {
  assertWorkOrderTransition,
  canTransitionWorkOrder,
  quickActionTarget,
} from "./workflow";

describe("work order number generation", () => {
  it("generates sequential WO-YYYY-000001 style numbers", () => {
    const first = nextWorkOrderNumber([], new Date("2026-07-10"));
    assert.equal(first, "WO-2026-000001");
    const second = nextWorkOrderNumber([first], new Date("2026-07-10"));
    assert.equal(second, "WO-2026-000002");
  });

  it("never reuses an existing number", () => {
    const existing = ["WO-2026-000001", "WO-2026-000003"];
    const next = nextWorkOrderNumber(existing, new Date("2026-07-10"));
    assert.equal(next, "WO-2026-000004");
    assert.ok(!existing.includes(next));
  });
});

describe("work order creation", () => {
  it("validates required fields", () => {
    const bad = validateCreateWorkOrderInput({
      title: "",
      description: "",
      customerName: "",
      siteName: "",
      serviceType: "BREAK_FIX",
      priority: "NORMAL",
      createdBy: "tester",
    });
    assert.equal(bad.ok, false);

    const good = validateCreateWorkOrderInput({
      title: "Test WO",
      description: "Desc",
      customerName: "SFX / MPX",
      siteName: "Chicago HQ",
      serviceType: "BREAK_FIX",
      priority: "HIGH",
      createdBy: "tester",
    });
    assert.equal(good.ok, true);
  });

  it("builds a work order with generated number", () => {
    const wo = buildWorkOrderFromInput(
      {
        title: "Install Valezus",
        description: "New install",
        customerName: "SFX / MPX",
        siteName: "Dallas",
        serviceType: "INSTALLATION",
        priority: "NORMAL",
        createdBy: "tester",
        assignedTechnician: "Toby Tompkins",
      },
      sampleWorkOrders.map((o) => o.workOrderNumber),
    );
    assert.match(wo.workOrderNumber, /^WO-2026-\d{6}$/);
    assert.equal(wo.status, "ASSIGNED");
    assert.equal(wo.title, "Install Valezus");
  });
});

describe("status transitions", () => {
  it("allows NEW → ASSIGNED and blocks CLOSED → NEW", () => {
    assert.equal(canTransitionWorkOrder("NEW", "ASSIGNED"), true);
    assert.equal(canTransitionWorkOrder("CLOSED", "NEW"), false);
    const bad = assertWorkOrderTransition("CANCELLED", "ON_SITE");
    assert.equal(bad.ok, false);
  });

  it("maps quick actions to valid targets", () => {
    assert.equal(quickActionTarget("start", "SCHEDULED"), "TRAVELING");
    assert.equal(quickActionTarget("pause", "ON_SITE"), "ON_HOLD");
    assert.equal(quickActionTarget("complete", "ON_SITE"), "COMPLETED");
    assert.equal(quickActionTarget("complete", "NEW"), null);
  });
});

describe("search and filters", () => {
  it("filters by status, priority, and search text", () => {
    const filters = {
      ...defaultWorkOrderFilters(),
      status: "WAITING_FOR_PARTS" as const,
    };
    const waiting = filterWorkOrders(sampleWorkOrders, filters);
    assert.ok(waiting.every((o) => o.status === "WAITING_FOR_PARTS"));

    const search = filterWorkOrders(sampleWorkOrders, {
      ...defaultWorkOrderFilters(),
      search: "critical",
    });
    assert.ok(search.length >= 1);
    assert.ok(
      search.some((o) => o.title.toLowerCase().includes("critical")),
    );
  });

  it("sorts by priority", () => {
    const sorted = sortWorkOrders(sampleWorkOrders, "priority", "asc");
    assert.ok(sorted.length > 1);
    const ranks = { CRITICAL: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
    for (let i = 1; i < sorted.length; i += 1) {
      assert.ok(ranks[sorted[i - 1].priority] <= ranks[sorted[i].priority]);
    }
  });
});

describe("dashboard metrics", () => {
  it("computes open, waiting, and critical counts", () => {
    const metrics = computeWorkOrderMetrics(
      sampleWorkOrders,
      new Date("2026-07-10"),
    );
    assert.ok(metrics.open >= 1);
    assert.ok(metrics.waitingForParts >= 1);
    assert.ok(metrics.critical >= 1);
  });
});

describe("work order permissions", () => {
  it("grants technician update rights and manager assign rights", () => {
    assert.equal(
      hasMatrixPermission("FIELD_TECHNICIAN", "VIEW_WORK_ORDERS"),
      true,
    );
    assert.equal(
      hasMatrixPermission("FIELD_TECHNICIAN", "UPDATE_WORK_ORDER"),
      true,
    );
    assert.equal(
      hasMatrixPermission("FIELD_TECHNICIAN", "ASSIGN_WORK_ORDER"),
      false,
    );
    assert.equal(
      hasMatrixPermission("SERVICE_MANAGER", "ASSIGN_WORK_ORDER"),
      true,
    );
    assert.equal(
      hasMatrixPermission("ADMIN", "MANAGE_WORK_ORDERS"),
      true,
    );
  });
});
