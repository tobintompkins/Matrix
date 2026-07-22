/**
 * Patch 51B — Enterprise Customer Portal unit tests.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertNoInternalLeak,
  mapPartsStatusForPortal,
  mapPmStatusForPortal,
  serializePortalTicket,
} from "./serializers";
import { getCustomerStatusLabel } from "./status-map";
import { DEFAULT_PORTAL_SETTINGS } from "./config";
import { hasMatrixPermission } from "@/lib/auth/permissions";

describe("portal serializers", () => {
  it("maps statuses safely", () => {
    assert.equal(mapPartsStatusForPortal("SUBMITTED"), "Submitted");
    assert.equal(mapPartsStatusForPortal("ORDERED"), "Ordered");
    assert.equal(mapPmStatusForPortal("OVERDUE"), "Overdue");
    assert.equal(mapPmStatusForPortal("DUE_SOON"), "Due Soon");
    assert.ok(getCustomerStatusLabel("WAITING_FOR_PARTS").length > 0);
  });

  it("rejects internal field leakage", () => {
    assert.throws(() =>
      assertNoInternalLeak({ ticket: { internalNotes: "secret" } }),
    );
    assert.doesNotThrow(() =>
      assertNoInternalLeak({
        ticket: { status: "Submitted", issueSummary: "Jam" },
      }),
    );
  });

  it("serializes tickets without internal cost fields", () => {
    const dto = serializePortalTicket({
      id: "t1",
      ticketNumber: "MX-SVC-1",
      printerId: "p1",
      printerLabel: "Printer",
      locationName: "Main",
      problemTitle: "Jam",
      customerStatus: "Submitted",
      priority: "NORMAL",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      scheduledWindow: "Tomorrow",
      technicianName: "Alex",
      resolutionSummary: "",
      partsDelay: "",
    });
    assert.equal(dto.serviceNumber, "MX-SVC-1");
    assert.equal(
      JSON.stringify(dto).includes("internalNotes"),
      false,
    );
  });
});

describe("portal permissions", () => {
  it("grants customer admin enterprise portal permissions", () => {
    assert.equal(
      hasMatrixPermission("CUSTOMER_ADMIN", "ACCESS_CUSTOMER_PORTAL"),
      true,
    );
    assert.equal(
      hasMatrixPermission("CUSTOMER_ADMIN", "SUBMIT_CUSTOMER_METER"),
      true,
    );
    assert.equal(
      hasMatrixPermission("CUSTOMER_ADMIN", "CREATE_CUSTOMER_PARTS_REQUEST"),
      true,
    );
    assert.equal(
      hasMatrixPermission("CUSTOMER_VIEWER", "CREATE_CUSTOMER_SERVICE_CALL"),
      false,
    );
    assert.equal(
      hasMatrixPermission("CUSTOMER_VIEWER", "VIEW_CUSTOMER_EQUIPMENT"),
      true,
    );
  });

  it("keeps portal defaults enabled", () => {
    assert.equal(DEFAULT_PORTAL_SETTINGS.portalEnabled, true);
    assert.equal(DEFAULT_PORTAL_SETTINGS.allowCustomerMeterSubmissions, true);
    assert.equal(DEFAULT_PORTAL_SETTINGS.allowCustomerPartsRequests, true);
  });
});
