import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  assertDispatchTransition,
  buildSlaSnapshot,
  canTransitionDispatch,
  completeTicketWithSignature,
  createDispatchTicket,
  detectRepeatFailures,
  evaluateEscalations,
  getCustomerView,
  getPmOpportunity,
  isValidServiceTicketNumber,
  markWaitingForParts,
  nextServiceTicketNumber,
  recommendTechnicians,
  renderServiceReportHtml,
  resetDispatchForTests,
  resetTicketNumberingForTests,
  SEED_TECHNICIANS,
  toCustomerVisibleTicket,
} from "./index";
import {
  createServiceCall,
  listServiceCalls,
  replaceServiceCall,
  type ServiceCall,
} from "@/lib/service-calls";

function ensureTestServiceCall(): ServiceCall {
  const existing = listServiceCalls().find(
    (c) => !["CLOSED", "CANCELLED"].includes(c.status),
  );
  if (existing) return existing;
  const result = createServiceCall({
    machineId: "yankee",
    serviceType: "BREAK_FIX",
    issueTitle: "Dispatch test call",
    problemDescription: "Created for unit tests after demo seeds were removed.",
    errorCode: "",
    symptoms: "",
    customerImpact: "",
    machineCurrentlyDown: false,
    priority: "NORMAL",
    reportedBy: "Test",
    reporterPhone: "",
    reporterEmail: "",
    technician: "Toby Tompkins",
    serviceManager: "Test Manager",
    organization: "SFX / MPX",
    region: "Portland, Maine",
    requestedServiceDate: "2026-09-17",
    scheduledStart: "2026-09-17T14:00:00.000Z",
    estimatedDurationHours: 1,
    isDraft: false,
    createdBy: "Test",
  });
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(result.error);
  return result.call;
}

describe("service dispatch Patch 41", () => {
  beforeEach(() => {
    resetDispatchForTests();
    resetTicketNumberingForTests();
  });

  it("generates unique MX-SVC ticket numbers", () => {
    const a = nextServiceTicketNumber([]);
    const b = nextServiceTicketNumber([a]);
    assert.notEqual(a, b);
    assert.equal(isValidServiceTicketNumber(a), true);
    assert.match(a, /^MX-SVC-2026-\d{6}$/);
  });

  it("creates dispatch tickets with MX numbers", () => {
    const machines = listServiceCalls();
    const machineId = machines[0]?.machine.machineId ?? "yankee";
    const result = createDispatchTicket({
      machineId,
      serviceType: "BREAK_FIX",
      issueTitle: "Paper jam bay A",
      problemDescription: "Repeated jam in registration",
      errorCode: "JAM-01",
      symptoms: "Jam",
      customerImpact: "Production delayed",
      machineCurrentlyDown: true,
      priority: "HIGH",
      reportedBy: "Ops Lead",
      reporterPhone: "555-0100",
      reporterEmail: "ops@example.com",
      technician: "",
      serviceManager: "Manager",
      organization: "SFX",
      region: "ME",
      requestedServiceDate: "2026-07-11",
      scheduledStart: "2026-07-11T14:00:00.000Z",
      estimatedDurationHours: 2,
      isDraft: false,
      createdBy: "Dispatcher",
      category: "PAPER_JAM",
      source: "DASHBOARD",
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(isValidServiceTicketNumber(result.ticketNumber), true);
      assert.equal(result.call.ticketNumber, result.ticketNumber);
    }
  });

  it("enforces status transition rules", () => {
    assert.equal(canTransitionDispatch("CLOSED", "TRAVELING"), false);
    assert.equal(assertDispatchTransition("CLOSED", "REOPENED").ok, true);
    assert.equal(assertDispatchTransition("CANCELLED", "ON_SITE").ok, false);
    assert.equal(canTransitionDispatch("ACCEPTED", "TRAVELING"), true);
  });

  it("calculates SLA warning and breach states", () => {
    const created = "2026-07-10T10:00:00.000Z";
    const ok = buildSlaSnapshot({
      createdAt: created,
      priority: "NORMAL",
      from: new Date("2026-07-10T10:30:00.000Z"),
    });
    assert.equal(ok.responseState, "OK");

    const breached = buildSlaSnapshot({
      createdAt: created,
      priority: "CRITICAL",
      from: new Date("2026-07-10T12:00:00.000Z"),
    });
    assert.equal(breached.responseState, "BREACHED");
  });

  it("evaluates escalation for critical unassigned tickets", () => {
    const sla = buildSlaSnapshot({
      createdAt: "2026-07-10T10:00:00.000Z",
      priority: "CRITICAL",
      from: new Date("2026-07-10T10:20:00.000Z"),
    });
    const events = evaluateEscalations({
      priority: "CRITICAL",
      status: "UNASSIGNED",
      assignedTechnician: "",
      createdAt: "2026-07-10T10:00:00.000Z",
      acceptedAt: null,
      scheduledEnd: null,
      statusEnteredAt: "2026-07-10T10:00:00.000Z",
      partsExpectedAt: null,
      satisfactionRating: null,
      reopened: false,
      repeatFailure: false,
      sla,
      escalationLevel: 0,
      from: new Date("2026-07-10T10:20:00.000Z"),
    });
    assert.ok(events.some((e) => e.trigger === "CRITICAL_UNASSIGNED"));
  });

  it("detects repeat failures", () => {
    const flags = detectRepeatFailures([
      {
        id: "t1",
        printerId: "p1",
        serialNumber: "SN-1",
        category: "PAPER_JAM",
        createdAt: "2026-07-09T10:00:00.000Z",
        status: "CLOSED",
        partsReplaced: ["DRUM-1"],
        downtimeMinutes: 60,
        reopened: false,
      },
      {
        id: "t2",
        printerId: "p1",
        serialNumber: "SN-1",
        category: "PAPER_JAM",
        createdAt: "2026-07-10T10:00:00.000Z",
        status: "OPEN",
        partsReplaced: ["DRUM-1"],
        downtimeMinutes: 90,
        reopened: true,
      },
    ], { from: new Date("2026-07-10T12:00:00.000Z") });
    assert.ok(flags.length >= 1);
    assert.equal(flags[0].badge, true);
  });

  it("recommends technicians with override-friendly scores", () => {
    const recs = recommendTechnicians({
      technicians: SEED_TECHNICIANS,
      printerModel: "GD9630",
      customerId: "cust-sfx",
      priority: "CRITICAL",
      siteLat: 43.66,
      siteLon: -70.25,
    });
    assert.ok(recs.length >= 1);
    assert.ok(recs[0].score >= recs[recs.length - 1].score);
  });

  it("redacts customer-visible updates and builds reports", () => {
    const visible = toCustomerVisibleTicket({
      ticketNumber: "MX-SVC-2026-000001",
      printer: "GD9630",
      problemDescription: "Jam",
      status: "ON_SITE",
      technicianName: "Toby",
      scheduledStart: "2026-07-11T14:00:00.000Z",
      scheduledEnd: "2026-07-11T16:00:00.000Z",
      estimatedArrival: "2026-07-11T14:30:00.000Z",
      partsDelay: "",
      resolutionSummary: "",
      updates: [
        {
          id: "1",
          ticketId: "t",
          updateType: "STATUS",
          previousStatus: "ASSIGNED",
          newStatus: "ON_SITE",
          message: "Arrived",
          createdBy: "Toby",
          createdAt: "2026-07-11T14:30:00.000Z",
          visibleToCustomer: true,
          attachmentUrl: null,
        },
        {
          id: "2",
          ticketId: "t",
          updateType: "INTERNAL",
          previousStatus: "ON_SITE",
          newStatus: "ON_SITE",
          message: "Internal cost note",
          createdBy: "Mgr",
          createdAt: "2026-07-11T14:31:00.000Z",
          visibleToCustomer: false,
          attachmentUrl: null,
        },
      ],
    });
    assert.equal(visible.updates.length, 1);
    const html = renderServiceReportHtml({
      ticketNumber: "MX-SVC-2026-000001",
      customer: "SFX",
      location: "Main",
      printerModel: "GD9630",
      serialNumber: "SN",
      openedAt: "2026-07-11T10:00:00.000Z",
      completedAt: "2026-07-11T15:00:00.000Z",
      technician: "Toby",
      reportedProblem: "Jam",
      diagnosis: "Worn roller",
      workPerformed: "Replaced roller",
      partsUsed: [{ partNumber: "R-1", description: "Roller", quantity: 1 }],
      meterCount: 1000,
      laborMinutes: 60,
      travelMinutes: 30,
      testResults: "OK",
      recommendations: "Monitor",
      customerSignature: "Signed",
      technicianSignature: "Toby",
      followUp: "",
      warrantyStatus: "ACTIVE",
    });
    assert.match(html, /MATRIX/);
    assert.match(html, /MX-SVC-2026-000001/);
  });

  it("marks waiting for parts and surfaces PM opportunity", () => {
    const open = ensureTestServiceCall();
    assert.ok(open);
    replaceServiceCall({ ...open!, status: "DIAGNOSING" });
    const r = markWaitingForParts(
      open!.id,
      "2026-07-15T00:00:00.000Z",
      "DRUM-UNIT",
      "Tech",
    );
    assert.equal(r.ok, true);
    const pm = getPmOpportunity(1_000_000, 1_020_000);
    assert.equal(pm?.level, "OPPORTUNITY");
  });

  it("requires signature or refusal to complete", () => {
    const open = ensureTestServiceCall();
    assert.ok(open);
    const fail = completeTicketWithSignature({
      ticketId: open!.id,
      meterAtClose: 123,
      resolutionSummary: "Fixed",
      workPerformed: "Fixed",
      testResults: "OK",
      finalCondition: "OPERATIONAL",
      technicianName: "Toby Tompkins",
      customerContactName: "Ops",
      customerSignature: "",
      actor: "Toby Tompkins",
    });
    assert.equal(fail.ok, false);

    const ok = completeTicketWithSignature({
      ticketId: open!.id,
      meterAtClose: 123,
      resolutionSummary: "Fixed",
      workPerformed: "Fixed",
      testResults: "OK",
      finalCondition: "OPERATIONAL",
      technicianName: "Toby Tompkins",
      customerContactName: "Ops",
      customerSignature: "Ops /s/",
      actor: "Toby Tompkins",
    });
    assert.equal(ok.ok, true);
    if (ok.ok) {
      assert.ok(ok.reportHtml.includes("Service Report"));
      const customer = getCustomerView(open!.id);
      assert.ok(customer);
      assert.ok(!JSON.stringify(customer).includes("internalNotes"));
    }
  });
});
