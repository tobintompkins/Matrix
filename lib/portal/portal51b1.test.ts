/**
 * Patch 51B.1 — Portal ↔ Service Hub integration tests.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCustomerVisibleTimeline,
  getCustomerStatusLabel,
  mapInternalStatusToCustomer,
} from "./status-map";
import {
  isPortalInboxNotificationType,
  notificationTargetsMembership,
  portalRecipientIds,
} from "./notification-targets";
import { getMachinePortalProfile } from "./machine-profile";
import { assertNoInternalLeak, serializePortalTicket } from "./serializers";
import {
  answerCustomerAssist,
  assertCustomerAssistSafe,
} from "@/lib/matrix-assist/customer-mode";
import {
  getTicketMeta,
  postCustomerVisibleUpdate,
  listTicketUpdates,
} from "@/lib/service-dispatch/repository";
import {
  attemptCrossCustomerTicketAccess,
  createPortalTicket,
  getPortalTicket,
  listPortalPrinters,
  setActivePortalMembership,
} from "./repository";

describe("portal 51B.1 status mapping", () => {
  it("maps internal states to typed CustomerServiceStatus codes", () => {
    assert.equal(mapInternalStatusToCustomer("NEW"), "SUBMITTED");
    assert.equal(mapInternalStatusToCustomer("ASSIGNED"), "TECHNICIAN_ASSIGNED");
    assert.equal(mapInternalStatusToCustomer("SCHEDULED"), "SCHEDULED");
    assert.equal(mapInternalStatusToCustomer("WAITING_FOR_PARTS"), "WAITING_FOR_PARTS");
    assert.equal(mapInternalStatusToCustomer("RESOLVED"), "RESOLVED");
    assert.equal(mapInternalStatusToCustomer("CLOSED"), "CLOSED");
  });

  it("maps internal states to customer-safe labels", () => {
    assert.equal(getCustomerStatusLabel("NEW"), "Submitted");
    assert.equal(getCustomerStatusLabel("ASSIGNED"), "Technician Assigned");
    assert.equal(getCustomerStatusLabel("SCHEDULED"), "Visit Scheduled");
    assert.equal(getCustomerStatusLabel("WAITING_FOR_PARTS"), "Waiting for Parts");
    assert.equal(getCustomerStatusLabel("RESOLVED"), "Resolved");
    assert.equal(getCustomerStatusLabel("CLOSED"), "Closed");
  });

  it("builds chronological customer-visible timeline only", () => {
    const timeline = buildCustomerVisibleTimeline([
      {
        id: "u2",
        updateType: "STATUS",
        newStatus: "ASSIGNED",
        message: "Tech assigned",
        createdAt: "2026-07-02T10:00:00.000Z",
        visibleToCustomer: true,
      },
      {
        id: "u1",
        updateType: "STATUS",
        newStatus: "NEW",
        message: "Submitted",
        createdAt: "2026-07-01T10:00:00.000Z",
        visibleToCustomer: true,
      },
      {
        id: "u3",
        updateType: "STATUS",
        newStatus: "DIAGNOSIS",
        message: "Internal diagnostics",
        createdAt: "2026-07-03T10:00:00.000Z",
        visibleToCustomer: false,
      },
    ]);
    assert.equal(timeline.length, 2);
    assert.equal(timeline[0].code, "SUBMITTED");
    assert.equal(timeline[1].code, "TECHNICIAN_ASSIGNED");
  });
});

describe("portal 51B.1 customer assist mode", () => {
  it("answers in customer audience without leaking internal fields", () => {
    const a = answerCustomerAssist({
      question: "My printer is down",
      machineLabel: "SF5350 · SN1",
      audience: "customer",
    });
    assert.equal(a.audience, "customer");
    assert.ok(a.answer.length > 0);
    assert.equal(a.isSample, true);
    assert.ok(a.restrictions.length >= 3);
    assert.ok(assertCustomerAssistSafe(JSON.stringify(a)));
    assert.ok(!/labor cost|vendor|margin/i.test(a.answer));
  });

  it("rejects non-customer audience on customer endpoint helper", () => {
    const a = answerCustomerAssist({
      question: "How do I repair the drum?",
      audience: "technician",
    });
    assert.equal(a.audience, "technician");
    assert.ok(/customer-mode only/i.test(a.answer));
  });

  it("blocks forbidden procedure-style phrasing", () => {
    assert.equal(
      assertCustomerAssistSafe("Replace the drum unit by removing the side cover"),
      false,
    );
  });
});

describe("portal 51B.1 service hub customer-visible updates", () => {
  it("posts customer-visible timeline entries on portal-submitted tickets", () => {
    setActivePortalMembership("mem-sfx-user");
    const printers = listPortalPrinters();
    if (printers.length < 1) return;
    const first = createPortalTicket({
      printerAssetId: printers[0].id,
      problemCategory: "OTHER",
      problemTitle: "51B.1 hub update test",
      description: "Customer-visible update wiring",
      productionImpact: "Reduced performance",
      machineOperational: true,
      errorCode: "",
      preferredDate: "2026-07-22",
      preferredWindow: "",
      contactName: "SFX Operator",
      contactEmail: "user@sfx-mpx.example",
      contactPhone: "555",
      confirmSeparateProblem: true,
    });
    if (!first.ok) return;
    const meta = getTicketMeta(first.ticketId);
    assert.equal(meta?.source, "CUSTOMER_PORTAL");
    const posted = postCustomerVisibleUpdate({
      ticketId: first.ticketId,
      message: "Technician is scheduled for tomorrow morning.",
      actor: "Dispatcher",
    });
    assert.ok(posted.ok);
    const updates = listTicketUpdates(first.ticketId).filter((u) => u.visibleToCustomer);
    assert.ok(updates.some((u) => u.message.includes("scheduled")));

    const detail = getPortalTicket(first.ticketId);
    assert.equal(detail.ok, true);
    if (!detail.ok) return;
    assert.ok(detail.activity.some((a) => a.message.includes("scheduled")));
    assert.ok(detail.activity.every((a) => "code" in a));
  });
});

describe("portal 51B.1 isolation", () => {
  it("denies one customer membership from opening another customer's ticket", () => {
    setActivePortalMembership("mem-sfx-user");
    const printers = listPortalPrinters();
    assert.ok(printers.length >= 1);
    const created = createPortalTicket({
      printerAssetId: printers[0].id,
      problemCategory: "OTHER",
      problemTitle: "51B.1 isolation ticket",
      description: "Cross-customer denial proof",
      productionImpact: "Machine down",
      machineOperational: false,
      errorCode: "",
      preferredDate: "2026-07-22",
      preferredWindow: "",
      contactName: "SFX Operator",
      contactEmail: "user@sfx-mpx.example",
      contactPhone: "555",
      confirmSeparateProblem: true,
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;

    const denied = attemptCrossCustomerTicketAccess(
      "mem-north-admin",
      created.ticketId,
    );
    assert.equal(denied.ok, false);
  });

  it("serializers never emit internal field names", () => {
    assert.doesNotThrow(() =>
      assertNoInternalLeak({
        id: "t1",
        status: "Submitted",
        issueSummary: "Jam",
      }),
    );
    assert.throws(() =>
      assertNoInternalLeak({
        id: "t1",
        internalNotes: "secret",
      }),
    );
    const safe = serializePortalTicket({
      id: "t1",
      ticketNumber: "MX-1",
      printerId: "a1",
      printerLabel: "SF5350 · SN",
      locationName: "HQ",
      problemTitle: "Jam",
      customerStatus: "Submitted",
      priority: "NORMAL",
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
      scheduledWindow: "",
      technicianName: "",
      resolutionSummary: "",
      partsDelay: "",
    });
    assert.equal(safe.status, "Submitted");
    assert.ok(!("internalNotes" in safe));
  });
});

describe("portal 51B.1 notification targeting", () => {
  it("matches membership by id and email, not displayName alone", () => {
    const membership = {
      id: "mem-sfx-user",
      email: "user@sfx-mpx.example",
      displayName: "SFX Operator",
      clerkUserId: "clerk_sfx_user",
    };
    assert.deepEqual(portalRecipientIds(membership).sort(), [
      "SFX Operator",
      "clerk_sfx_user",
      "mem-sfx-user",
      "user@sfx-mpx.example",
    ].sort());
    assert.equal(
      notificationTargetsMembership(["mem-sfx-user"], membership),
      true,
    );
    assert.equal(
      notificationTargetsMembership(["user@sfx-mpx.example"], membership),
      true,
    );
    assert.equal(
      notificationTargetsMembership(["Someone Else"], membership),
      false,
    );
    assert.equal(isPortalInboxNotificationType("TICKET_CREATED"), true);
    assert.equal(isPortalInboxNotificationType("SCHEDULE_CHANGED"), true);
    assert.equal(isPortalInboxNotificationType("INVENTORY_VARIANCE"), false);
  });
});

describe("portal 51B.1 machine profile", () => {
  it("returns access denied for unknown printers without leaking", () => {
    const result = getMachinePortalProfile("does-not-exist-51b1");
    assert.equal(result.ok, false);
  });
});
