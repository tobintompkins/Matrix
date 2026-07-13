import type { ServiceCall } from "@/lib/service-calls/types";
import {
  createServiceCall,
  getServiceCall,
  listServiceCalls,
  reassignServiceCall,
  replaceServiceCall,
  updateServiceCallStatus,
} from "@/lib/service-calls/repository";
import type { CreateServiceCallInput } from "@/lib/service-calls/types";
import { primaryWarrantyStatus } from "@/lib/crm";
import { DEFAULT_PROBLEM_CATEGORIES } from "./categories";
import { evaluateEscalations } from "./escalation";
import { nextServiceTicketNumber } from "./numbering";
import {
  buildServiceReport,
  diagnosticToResolutionSummary,
  emptyDiagnostic,
  renderServiceReportHtml,
  toCustomerVisibleTicket,
} from "./report";
import { detectRepeatFailures } from "./repeat-failure";
import { buildSlaSnapshot, slaWarningMessages } from "./sla";
import { recommendTechnicians, SEED_TECHNICIANS } from "./technicians";
import type {
  DiagnosticRecord,
  DiagnosticTemplate,
  DispatchAssignment,
  DispatchBoardFilters,
  DispatchDashboardMetrics,
  DispatchPriority,
  DispatchTicketStatus,
  EscalationLevel,
  OfflineDraft,
  ProblemCategory,
  SlaRule,
  TechnicianProfile,
  TicketAuditEntry,
  TicketLaborEntry,
  TicketUpdate,
} from "./types";
import { assertDispatchTransition, isUnassignedStatus } from "./workflow";
import { DEFAULT_SLA_RULES } from "./sla";

const STORAGE_KEY = "matrix.service-dispatch.v1";

type DispatchStore = {
  categories: ProblemCategory[];
  slaRules: SlaRule[];
  technicians: TechnicianProfile[];
  assignments: DispatchAssignment[];
  updates: TicketUpdate[];
  labor: TicketLaborEntry[];
  diagnostics: Record<string, DiagnosticRecord>;
  templates: DiagnosticTemplate[];
  audit: TicketAuditEntry[];
  drafts: OfflineDraft[];
  escalationLevels: Record<string, EscalationLevel>;
  ticketMeta: Record<
    string,
    {
      mxTicketNumber: string;
      category: string;
      source: string;
      warrantyStatus: string;
      contractStatus: string;
      meterAtOpen: number | null;
      meterAtClose: number | null;
      billable: boolean;
      remoteResolution: boolean;
      parentTicketId: string | null;
      partsExpectedAt: string | null;
      statusEnteredAt: string;
      acceptedAt: string | null;
      reportHtml: string | null;
    }
  >;
};

function seedStore(): DispatchStore {
  return {
    categories: structuredClone(DEFAULT_PROBLEM_CATEGORIES),
    slaRules: structuredClone(DEFAULT_SLA_RULES),
    technicians: structuredClone(SEED_TECHNICIANS),
    assignments: [],
    updates: [],
    labor: [],
    diagnostics: {},
    templates: [
      {
        id: "tmpl-print-quality",
        name: "Print quality baseline",
        category: "PRINT_QUALITY",
        body: {
          ...emptyDiagnostic(),
          diagnosticSteps: "1) Print test chart\n2) Check ink levels\n3) Inspect drum/belt",
          firmwareChecked: "Controller + engine firmware versions recorded",
        },
        createdBy: "System",
        updatedAt: "2026-07-01T00:00:00.000Z",
      },
    ],
    audit: [],
    drafts: [],
    escalationLevels: {},
    ticketMeta: {},
  };
}

let memory: DispatchStore | null = null;

function canUseStorage() {
  return typeof window !== "undefined" && typeof sessionStorage !== "undefined";
}

function readStore(): DispatchStore {
  if (!canUseStorage()) {
    if (!memory) memory = seedStore();
    return memory;
  }
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = seedStore();
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
      memory = seeded;
      return seeded;
    }
    memory = JSON.parse(raw) as DispatchStore;
    return memory;
  } catch {
    memory = seedStore();
    return memory;
  }
}

function writeStore(store: DispatchStore) {
  memory = store;
  if (canUseStorage()) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function id(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function pushAudit(
  store: DispatchStore,
  entry: Omit<TicketAuditEntry, "id" | "occurredAt">,
): DispatchStore {
  return {
    ...store,
    audit: [
      {
        id: id("aud"),
        occurredAt: nowIso(),
        ...entry,
      },
      ...store.audit,
    ],
  };
}

function mapPriority(p: string): DispatchPriority {
  if (p === "URGENT" || p === "EMERGENCY" || p === "CRITICAL") return "CRITICAL";
  if (p === "HIGH") return "HIGH";
  if (p === "LOW") return "LOW";
  return "NORMAL";
}

function ensureMeta(call: ServiceCall, store: DispatchStore): DispatchStore {
  if (store.ticketMeta[call.id]) return store;
  const existingNums = Object.values(store.ticketMeta).map((m) => m.mxTicketNumber);
  existingNums.push(...listServiceCalls().map((c) => c.ticketNumber));
  const mx =
    call.ticketNumber.startsWith("MX-SVC-")
      ? call.ticketNumber
      : nextServiceTicketNumber(existingNums);
  return {
    ...store,
    ticketMeta: {
      ...store.ticketMeta,
      [call.id]: {
        mxTicketNumber: mx,
        category: "OTHER",
        source: "MANUAL",
        warrantyStatus: "UNKNOWN",
        contractStatus: "UNKNOWN",
        meterAtOpen: call.machine.currentMeterCount,
        meterAtClose: null,
        billable: true,
        remoteResolution: false,
        parentTicketId: null,
        partsExpectedAt: null,
        statusEnteredAt: call.updatedAt || call.createdAt,
        acceptedAt: null,
        reportHtml: null,
      },
    },
  };
}

export function resetDispatchForTests() {
  memory = null;
  if (canUseStorage()) sessionStorage.removeItem(STORAGE_KEY);
}

export function listCategories() {
  return readStore().categories;
}

export function saveCategories(categories: ProblemCategory[]) {
  const store = readStore();
  writeStore({ ...store, categories });
}

export function listTechnicians() {
  return readStore().technicians;
}

export function listSlaRules() {
  return readStore().slaRules;
}

export function getTicketMeta(ticketId: string) {
  let store = readStore();
  const call = getServiceCall(ticketId);
  if (!call) return null;
  store = ensureMeta(call, store);
  writeStore(store);
  return store.ticketMeta[call.id];
}

export function getMxTicketNumber(ticketId: string): string {
  return getTicketMeta(ticketId)?.mxTicketNumber ?? ticketId;
}

export type CreateDispatchTicketInput = CreateServiceCallInput & {
  category?: string;
  source?: string;
  preferredWindowStart?: string;
  preferredWindowEnd?: string;
  customerId?: string;
  locationId?: string;
};

export function createDispatchTicket(input: CreateDispatchTicketInput) {
  const store = readStore();
  const existingNums = [
    ...Object.values(store.ticketMeta).map((m) => m.mxTicketNumber),
    ...listServiceCalls().map((c) => c.ticketNumber),
  ];
  const mxNumber = nextServiceTicketNumber(existingNums);

  const result = createServiceCall({
    ...input,
    scheduledStart: input.preferredWindowStart || input.scheduledStart,
  });
  if (!result.ok) return result;

  let call = result.call;
  // Stamp immutable MX ticket number onto ticketNumber field for search
  call = {
    ...call,
    ticketNumber: mxNumber,
  };
  replaceServiceCall(call);

  let warrantyStatus = "UNKNOWN";
  try {
    // Best-effort CRM warranty lookup by digital twin id patterns
    warrantyStatus = primaryWarrantyStatus(`asset-${call.machine.machineId}`) || "UNKNOWN";
  } catch {
    warrantyStatus = "UNKNOWN";
  }

  let next = ensureMeta(call, store);
  next = {
    ...next,
    ticketMeta: {
      ...next.ticketMeta,
      [call.id]: {
        ...next.ticketMeta[call.id],
        mxTicketNumber: mxNumber,
        category: input.category ?? "OTHER",
        source: input.source ?? "DASHBOARD",
        warrantyStatus: String(warrantyStatus),
        contractStatus: "ACTIVE",
        meterAtOpen: call.machine.currentMeterCount,
        statusEnteredAt: nowIso(),
      },
    },
  };
  next = pushAudit(next, {
    ticketId: call.id,
    ticketNumber: mxNumber,
    action: "CREATED",
    field: "ticket",
    previousValue: "",
    newValue: mxNumber,
    actor: input.createdBy,
    sessionInfo: "web",
  });

  if (input.technician) {
    const assignment: DispatchAssignment = {
      id: id("asg"),
      ticketId: call.id,
      technicianId:
        SEED_TECHNICIANS.find((t) => t.name === input.technician)?.id ?? "tech-unknown",
      technicianName: input.technician,
      assignedBy: input.createdBy,
      assignedAt: nowIso(),
      acceptedAt: null,
      declinedAt: null,
      declineReason: "",
      estimatedArrival: input.preferredWindowStart || null,
      actualArrival: null,
      dispatchStatus: "PENDING",
      reassignmentReason: "",
    };
    next = { ...next, assignments: [assignment, ...next.assignments] };
  }

  writeStore(next);
  return { ok: true as const, call, ticketNumber: mxNumber };
}

export function transitionDispatchTicket(
  ticketId: string,
  to: DispatchTicketStatus,
  user: string,
  note = "",
) {
  const call = getServiceCall(ticketId);
  if (!call) return { ok: false as const, error: "Ticket not found." };

  const gate = assertDispatchTransition(
    call.status as DispatchTicketStatus,
    to,
  );
  if (!gate.ok) return { ok: false as const, error: gate.message };

  if (to === "CLOSED") {
    const meta = getTicketMeta(call.id);
    if (!call.resolution.resolutionSummary.trim()) {
      return { ok: false as const, error: "A ticket cannot close without a resolution summary." };
    }
    if (meta && meta.meterAtClose == null && call.machine.currentMeterCount == null) {
      return { ok: false as const, error: "Final meter count is required before completion." };
    }
  }

  // Map Patch 41 statuses onto service-call statuses where needed
  const legacyMap: Record<string, string> = {
    TRAVELING: "EN_ROUTE",
    DIAGNOSIS: "DIAGNOSING",
    CUSTOMER_REVIEW: "WAITING_FOR_CUSTOMER",
    AWAITING_REVIEW: "NEW",
    TECHNICIAN_NOTIFIED: "ASSIGNED",
    SCHEDULED: "ACCEPTED",
    REPAIR_IN_PROGRESS: "DIAGNOSING",
    TESTING: "DIAGNOSING",
    FOLLOW_UP_REQUIRED: "RESOLVED",
    REOPENED: "DIAGNOSING",
  };
  const serviceStatus = (legacyMap[to] ?? to) as Parameters<
    typeof updateServiceCallStatus
  >[1];

  // For statuses that exist on ServiceCall, use repository transition
  const directOk = [
    "NEW",
    "UNASSIGNED",
    "ASSIGNED",
    "ACCEPTED",
    "EN_ROUTE",
    "ON_SITE",
    "DIAGNOSING",
    "WAITING_FOR_PARTS",
    "WAITING_FOR_CUSTOMER",
    "ESCALATED",
    "RESOLVED",
    "CLOSED",
    "CANCELLED",
  ].includes(serviceStatus);

  let updated = call;
  if (directOk) {
    // Allow reopen path: CLOSED -> need special handling
    if (call.status === "CLOSED" || call.status === "CANCELLED") {
      const reopened = {
        ...call,
        status: "DIAGNOSING" as const,
        closedAt: "",
        updatedAt: nowIso(),
      };
      replaceServiceCall(reopened);
      updated = reopened;
    } else {
      const result = updateServiceCallStatus(call.id, serviceStatus, user);
      if (!result.ok) return result;
      updated = result.call;
    }
  } else {
    updated = { ...call, status: serviceStatus as typeof call.status, updatedAt: nowIso() };
    replaceServiceCall(updated);
  }

  let store = readStore();
  store = ensureMeta(updated, store);
  const prev = store.ticketMeta[updated.id];
  store = {
    ...store,
    ticketMeta: {
      ...store.ticketMeta,
      [updated.id]: {
        ...prev,
        statusEnteredAt: nowIso(),
        acceptedAt:
          to === "ACCEPTED" ? nowIso() : prev.acceptedAt,
      },
    },
    updates: [
      {
        id: id("upd"),
        ticketId: updated.id,
        updateType: "STATUS",
        previousStatus: call.status,
        newStatus: to,
        message: note || `Status changed to ${to}`,
        createdBy: user,
        createdAt: nowIso(),
        visibleToCustomer: ![
          "ESCALATED",
          "DIAGNOSIS",
          "REPAIR_IN_PROGRESS",
        ].includes(to),
        attachmentUrl: null,
      },
      ...store.updates,
    ],
  };
  store = pushAudit(store, {
    ticketId: updated.id,
    ticketNumber: prev.mxTicketNumber,
    action: "STATUS_CHANGE",
    field: "status",
    previousValue: call.status,
    newValue: to,
    actor: user,
    sessionInfo: "web",
  });
  writeStore(store);
  return { ok: true as const, call: updated };
}

export function assignTechnician(
  ticketId: string,
  technicianName: string,
  assignedBy: string,
  estimatedArrival?: string,
) {
  const result = reassignServiceCall(ticketId, technicianName, assignedBy);
  if (!result.ok) return result;

  let store = readStore();
  store = ensureMeta(result.call, store);
  const tech =
    store.technicians.find((t) => t.name === technicianName) ??
    SEED_TECHNICIANS.find((t) => t.name === technicianName);

  const assignment: DispatchAssignment = {
    id: id("asg"),
    ticketId,
    technicianId: tech?.id ?? "tech-unknown",
    technicianName,
    assignedBy,
    assignedAt: nowIso(),
    acceptedAt: null,
    declinedAt: null,
    declineReason: "",
    estimatedArrival: estimatedArrival ?? null,
    actualArrival: null,
    dispatchStatus: "PENDING",
    reassignmentReason: "",
  };

  store = {
    ...store,
    assignments: [assignment, ...store.assignments],
    technicians: store.technicians.map((t) =>
      t.name === technicianName
        ? { ...t, status: "ASSIGNED" as const, currentTicketId: ticketId, dailyTicketCount: t.dailyTicketCount + 1 }
        : t,
    ),
  };
  store = pushAudit(store, {
    ticketId,
    ticketNumber: store.ticketMeta[ticketId]?.mxTicketNumber ?? ticketId,
    action: "ASSIGNED",
    field: "technician",
    previousValue: "",
    newValue: technicianName,
    actor: assignedBy,
    sessionInfo: "web",
  });
  writeStore(store);
  return { ok: true as const, call: result.call, assignment };
}

export function acceptAssignment(ticketId: string, technicianName: string) {
  const store = readStore();
  const assignments = store.assignments.map((a) =>
    a.ticketId === ticketId && a.technicianName === technicianName
      ? { ...a, acceptedAt: nowIso(), dispatchStatus: "ACCEPTED" as const }
      : a,
  );
  writeStore({ ...store, assignments });
  return transitionDispatchTicket(ticketId, "ACCEPTED", technicianName, "Assignment accepted");
}

export function declineAssignment(
  ticketId: string,
  technicianName: string,
  reason: string,
) {
  const call = getServiceCall(ticketId);
  if (!call) return { ok: false as const, error: "Ticket not found." };

  const store = readStore();
  const assignments = store.assignments.map((a) =>
    a.ticketId === ticketId && a.technicianName === technicianName
      ? {
          ...a,
          declinedAt: nowIso(),
          declineReason: reason,
          dispatchStatus: "DECLINED" as const,
        }
      : a,
  );
  writeStore({
    ...store,
    assignments,
    updates: [
      {
        id: id("upd"),
        ticketId,
        updateType: "ASSIGNMENT",
        previousStatus: call.status,
        newStatus: "UNASSIGNED",
        message: `Assignment declined: ${reason}`,
        createdBy: technicianName,
        createdAt: nowIso(),
        visibleToCustomer: false,
        attachmentUrl: null,
      },
      ...store.updates,
    ],
  });

  const cleared = {
    ...call,
    assignment: { ...call.assignment, technician: "" },
    status: "UNASSIGNED" as const,
    updatedAt: nowIso(),
  };
  replaceServiceCall(cleared);
  return { ok: true as const, call: cleared };
}

export function getRecommendationsForTicket(ticketId: string) {
  const call = getServiceCall(ticketId);
  if (!call) return [];
  return recommendTechnicians({
    technicians: listTechnicians(),
    printerModel: call.machine.printerModel,
    printerId: call.machine.machineId,
    priority: call.priority,
  });
}

export function getSlaForTicket(ticketId: string) {
  const call = getServiceCall(ticketId);
  if (!call) return null;
  return buildSlaSnapshot({
    createdAt: call.createdAt,
    priority: mapPriority(call.priority),
    rules: listSlaRules(),
  });
}

export function runEscalationsForTicket(ticketId: string) {
  const call = getServiceCall(ticketId);
  if (!call) return [];
  const store = readStore();
  const meta = store.ticketMeta[ticketId];
  const sla = buildSlaSnapshot({
    createdAt: call.createdAt,
    priority: mapPriority(call.priority),
    rules: store.slaRules,
  });
  const repeats = detectRepeatFailures(
    listServiceCalls().map((c) => ({
      id: c.id,
      printerId: c.machine.machineId,
      serialNumber: c.machine.serialNumber,
      category: store.ticketMeta[c.id]?.category ?? "OTHER",
      createdAt: c.createdAt,
      status: c.status,
      partsReplaced: c.parts.filter((p) => p.used).map((p) => p.partNumber),
      downtimeMinutes: c.problem.machineCurrentlyDown ? 120 : 0,
      reopened: false,
    })),
  );
  const events = evaluateEscalations({
    priority: mapPriority(call.priority),
    status: call.status,
    assignedTechnician: call.assignment.technician,
    createdAt: call.createdAt,
    acceptedAt: meta?.acceptedAt ?? null,
    scheduledEnd: call.schedule.scheduledEnd || null,
    statusEnteredAt: meta?.statusEnteredAt ?? null,
    partsExpectedAt: meta?.partsExpectedAt ?? null,
    satisfactionRating: call.customerConfirmation.satisfactionRating,
    reopened: false,
    repeatFailure: repeats.some((r) => r.printerId === call.machine.machineId),
    sla,
    escalationLevel: store.escalationLevels[ticketId] ?? 0,
  });
  if (events.length) {
    const maxLevel = Math.max(
      store.escalationLevels[ticketId] ?? 0,
      ...events.map((e) => e.newLevel),
    ) as EscalationLevel;
    writeStore({
      ...store,
      escalationLevels: { ...store.escalationLevels, [ticketId]: maxLevel },
    });
  }
  return events;
}

export function computeDispatchMetrics(
  calls: ServiceCall[] = listServiceCalls(),
): DispatchDashboardMetrics {
  const store = readStore();
  const today = new Date().toISOString().slice(0, 10);
  const techs = store.technicians;

  let slaAtRisk = 0;
  let slaBreached = 0;
  for (const c of calls) {
    if (["CLOSED", "CANCELLED", "RESOLVED"].includes(c.status)) continue;
    const sla = buildSlaSnapshot({
      createdAt: c.createdAt,
      priority: mapPriority(c.priority),
      rules: store.slaRules,
    });
    if (sla.responseState === "AT_RISK" || sla.resolutionState === "AT_RISK") slaAtRisk += 1;
    if (sla.responseState === "BREACHED" || sla.resolutionState === "BREACHED")
      slaBreached += 1;
  }

  const resolvedToday = calls.filter(
    (c) =>
      (c.status === "RESOLVED" || c.status === "CLOSED") &&
      (c.closedAt || c.updatedAt).startsWith(today),
  ).length;

  const closed = calls.filter((c) => c.status === "CLOSED" || c.status === "RESOLVED");
  const firstTime = closed.filter((c) => !c.activity.some((a) => a.activityType === "CALL_REOPENED"));

  return {
    newTickets: calls.filter((c) => c.status === "NEW").length,
    unassigned: calls.filter((c) => isUnassignedStatus(c.status as DispatchTicketStatus) || !c.assignment.technician).length,
    critical: calls.filter(
      (c) =>
        (c.priority === "URGENT" || c.priority === "EMERGENCY" || c.priority === "CRITICAL") &&
        !["CLOSED", "CANCELLED"].includes(c.status),
    ).length,
    techniciansTraveling: techs.filter((t) => t.status === "TRAVELING").length,
    techniciansOnSite: techs.filter((t) => t.status === "ON_SITE").length,
    waitingForParts: calls.filter((c) => c.status === "WAITING_FOR_PARTS").length,
    slaAtRisk,
    slaBreached,
    resolvedToday,
    reopened: calls.filter((c) =>
      c.activity.some((a) => a.activityType === "CALL_REOPENED"),
    ).length,
    averageResponseMinutes: null,
    averageRepairMinutes: null,
    firstTimeFixRate:
      closed.length === 0 ? null : Math.round((firstTime.length / closed.length) * 1000) / 10,
  };
}

export function filterDispatchBoard(
  calls: ServiceCall[],
  filters: DispatchBoardFilters,
): ServiceCall[] {
  const q = filters.search.trim().toLowerCase();
  return calls.filter((c) => {
    const meta = readStore().ticketMeta[c.id];
    if (filters.status && filters.status !== "ALL" && c.status !== filters.status) return false;
    if (filters.priority && filters.priority !== "ALL" && c.priority !== filters.priority)
      return false;
    if (filters.customer && !c.machine.customerName.toLowerCase().includes(filters.customer.toLowerCase()))
      return false;
    if (filters.location && !c.machine.siteName.toLowerCase().includes(filters.location.toLowerCase()))
      return false;
    if (filters.technician && c.assignment.technician !== filters.technician) return false;
    if (filters.printerModel && c.machine.printerModel !== filters.printerModel) return false;
    if (!q) return true;
    const hay = [
      c.ticketNumber,
      meta?.mxTicketNumber,
      c.workOrderNumber,
      c.machine.customerName,
      c.machine.serialNumber,
      c.problem.issueTitle,
      c.problem.problemDescription,
      c.problem.errorCode,
      c.assignment.technician,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

export function boardColumns(calls: ServiceCall[]) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    unassigned: calls.filter(
      (c) => !c.assignment.technician || isUnassignedStatus(c.status as DispatchTicketStatus),
    ),
    assigned: calls.filter(
      (c) =>
        c.assignment.technician &&
        ["ASSIGNED", "ACCEPTED", "TECHNICIAN_NOTIFIED", "SCHEDULED"].includes(c.status),
    ),
    active: calls.filter((c) =>
      ["EN_ROUTE", "TRAVELING", "ON_SITE", "DIAGNOSING", "DIAGNOSIS", "REPAIR_IN_PROGRESS", "TESTING"].includes(
        c.status,
      ),
    ),
    waitingForParts: calls.filter((c) => c.status === "WAITING_FOR_PARTS"),
    critical: calls.filter(
      (c) =>
        (c.priority === "URGENT" || c.priority === "EMERGENCY") &&
        !["CLOSED", "CANCELLED", "RESOLVED"].includes(c.status),
    ),
    completedToday: calls.filter(
      (c) =>
        (c.status === "CLOSED" || c.status === "RESOLVED") &&
        (c.closedAt || c.updatedAt).startsWith(today),
    ),
  };
}

export function saveDiagnostic(ticketId: string, diagnostic: DiagnosticRecord, actor: string) {
  let store = readStore();
  store = {
    ...store,
    diagnostics: { ...store.diagnostics, [ticketId]: diagnostic },
  };
  store = pushAudit(store, {
    ticketId,
    ticketNumber: store.ticketMeta[ticketId]?.mxTicketNumber ?? ticketId,
    action: "DIAGNOSIS_UPDATED",
    field: "diagnosis",
    previousValue: "",
    newValue: diagnostic.rootCause || diagnostic.confirmedSymptom,
    actor,
    sessionInfo: "web",
  });
  writeStore(store);

  const call = getServiceCall(ticketId);
  if (call) {
    replaceServiceCall({
      ...call,
      resolution: {
        ...call.resolution,
        diagnosis: diagnostic.confirmedSymptom || call.resolution.diagnosis,
        rootCause: diagnostic.rootCause || call.resolution.rootCause,
        workPerformed: diagnostic.correctiveAction || call.resolution.workPerformed,
        resolutionSummary:
          call.resolution.resolutionSummary ||
          diagnosticToResolutionSummary(diagnostic),
        technicianRecommendations:
          diagnostic.additionalRecommendations ||
          call.resolution.technicianRecommendations,
      },
    });
  }
  return diagnostic;
}

export function getDiagnostic(ticketId: string) {
  return readStore().diagnostics[ticketId] ?? emptyDiagnostic();
}

export function listDiagnosticTemplates() {
  return readStore().templates;
}

export function addLabor(entry: Omit<TicketLaborEntry, "id">) {
  const store = readStore();
  const row: TicketLaborEntry = { ...entry, id: id("lab") };
  writeStore({ ...store, labor: [row, ...store.labor] });
  return row;
}

export function listLabor(ticketId: string) {
  return readStore().labor.filter((l) => l.ticketId === ticketId);
}

export function listTicketUpdates(ticketId: string) {
  return readStore().updates.filter((u) => u.ticketId === ticketId);
}

export function listTicketAudit(ticketId?: string) {
  const rows = readStore().audit;
  return ticketId ? rows.filter((a) => a.ticketId === ticketId) : rows;
}

export function saveOfflineDraft(draft: OfflineDraft) {
  const store = readStore();
  const drafts = store.drafts.filter((d) => d.ticketId !== draft.ticketId);
  writeStore({ ...store, drafts: [draft, ...drafts] });
}

export function getOfflineDraft(ticketId: string) {
  return readStore().drafts.find((d) => d.ticketId === ticketId) ?? null;
}

export function completeTicketWithSignature(input: {
  ticketId: string;
  meterAtClose: number;
  resolutionSummary: string;
  workPerformed: string;
  testResults: string;
  finalCondition: string;
  technicianName: string;
  customerContactName: string;
  customerSignature: string;
  signatureRefusedReason?: string;
  actor: string;
}) {
  const call = getServiceCall(input.ticketId);
  if (!call) return { ok: false as const, error: "Ticket not found." };
  if (!input.resolutionSummary.trim()) {
    return { ok: false as const, error: "Resolution summary is required." };
  }
  if (!input.customerSignature && !input.signatureRefusedReason) {
    return {
      ok: false as const,
      error: "Customer signature or documented refusal reason is required.",
    };
  }

  const updated = {
    ...call,
    resolution: {
      ...call.resolution,
      resolutionSummary: input.resolutionSummary,
      workPerformed: input.workPerformed,
      finalMachineStatus: "OPERATIONAL" as const,
      technicianName: input.technicianName,
      completedAt: nowIso(),
      technicianRecommendations: input.testResults,
    },
    customerConfirmation: {
      ...call.customerConfirmation,
      customerContactName: input.customerContactName,
      customerSignaturePlaceholder:
        input.customerSignature || `REFUSED: ${input.signatureRefusedReason}`,
      technicianSignaturePlaceholder: input.technicianName,
      completionAcknowledged: Boolean(input.customerSignature),
    },
  };
  replaceServiceCall(updated);

  let store = readStore();
  store = ensureMeta(updated, store);
  const meta = store.ticketMeta[updated.id];
  const report = buildServiceReport({
    ticketNumber: meta.mxTicketNumber,
    customer: updated.machine.customerName,
    location: updated.machine.siteName,
    printerModel: updated.machine.printerModel,
    serialNumber: updated.machine.serialNumber,
    openedAt: updated.createdAt,
    completedAt: nowIso(),
    technician: input.technicianName,
    reportedProblem: updated.problem.issueTitle,
    diagnosis: getDiagnostic(updated.id),
    workPerformed: input.workPerformed,
    partsUsed: updated.parts
      .filter((p) => p.used)
      .map((p) => ({
        partNumber: p.partNumber,
        description: p.description,
        quantity: p.quantity,
      })),
    meterCount: input.meterAtClose,
    labor: listLabor(updated.id),
    testResults: input.testResults,
    recommendations: updated.resolution.technicianRecommendations,
    customerSignature: input.customerSignature || `REFUSED: ${input.signatureRefusedReason}`,
    technicianSignature: input.technicianName,
    followUp: updated.resolution.followUpRequired
      ? updated.resolution.followUpDate
      : "",
    warrantyStatus: meta.warrantyStatus,
  });
  const html = renderServiceReportHtml(report);
  store = {
    ...store,
    ticketMeta: {
      ...store.ticketMeta,
      [updated.id]: {
        ...meta,
        meterAtClose: input.meterAtClose,
        reportHtml: html,
      },
    },
  };
  store = pushAudit(store, {
    ticketId: updated.id,
    ticketNumber: meta.mxTicketNumber,
    action: "SIGNATURE_COLLECTED",
    field: "customerSignature",
    previousValue: "",
    newValue: input.customerSignature ? "signed" : "refused",
    actor: input.actor,
    sessionInfo: "web",
  });
  writeStore(store);

  // Completion may jump from mid-workflow states — record as RESOLVED via service-call path.
  let resolved = updated;
  if (updated.status !== "RESOLVED" && updated.status !== "CLOSED") {
    const jump = {
      ...updated,
      status: "RESOLVED" as const,
      updatedAt: nowIso(),
      resolution: {
        ...updated.resolution,
        resolutionSummary: input.resolutionSummary,
        workPerformed: input.workPerformed,
        completedAt: nowIso(),
        technicianName: input.technicianName,
      },
    };
    replaceServiceCall(jump);
    resolved = jump;
  }

  let store2 = readStore();
  store2 = pushAudit(store2, {
    ticketId: resolved.id,
    ticketNumber: meta.mxTicketNumber,
    action: "RESOLVED",
    field: "status",
    previousValue: call.status,
    newValue: "RESOLVED",
    actor: input.actor,
    sessionInfo: "web",
  });
  writeStore(store2);

  return { ok: true as const, call: resolved, report, reportHtml: html };
}

export function getCustomerView(ticketId: string) {
  const call = getServiceCall(ticketId);
  if (!call) return null;
  const meta = getTicketMeta(ticketId);
  return toCustomerVisibleTicket({
    ticketNumber: meta?.mxTicketNumber ?? call.ticketNumber,
    printer: `${call.machine.printerModel} · ${call.machine.serialNumber}`,
    problemDescription: call.problem.problemDescription,
    status: call.status,
    technicianName: call.assignment.technician,
    scheduledStart: call.schedule.scheduledStart,
    scheduledEnd: call.schedule.scheduledEnd,
    estimatedArrival: call.schedule.arrivalDateTime,
    partsDelay:
      call.status === "WAITING_FOR_PARTS"
        ? meta?.partsExpectedAt ?? "Parts delayed — ETA pending"
        : "",
    resolutionSummary: call.resolution.resolutionSummary,
    updates: listTicketUpdates(ticketId),
  });
}

export function getRepeatFailureFlags() {
  const store = readStore();
  return detectRepeatFailures(
    listServiceCalls().map((c) => ({
      id: c.id,
      printerId: c.machine.machineId,
      serialNumber: c.machine.serialNumber,
      category: store.ticketMeta[c.id]?.category ?? "OTHER",
      createdAt: c.createdAt,
      status: c.status,
      partsReplaced: c.parts.filter((p) => p.used).map((p) => p.partNumber),
      downtimeMinutes: c.problem.machineCurrentlyDown ? 180 : 30,
      reopened: c.activity.some((a) => a.activityType === "CALL_REOPENED"),
    })),
  );
}

export function getSlaWarnings(ticketId: string) {
  const sla = getSlaForTicket(ticketId);
  return sla ? slaWarningMessages(sla) : [];
}

export function markWaitingForParts(
  ticketId: string,
  expectedArrival: string,
  missingPart: string,
  actor: string,
) {
  let store = readStore();
  const call = getServiceCall(ticketId);
  if (!call) return { ok: false as const, error: "Ticket not found." };
  store = ensureMeta(call, store);
  store = {
    ...store,
    ticketMeta: {
      ...store.ticketMeta,
      [ticketId]: {
        ...store.ticketMeta[ticketId],
        partsExpectedAt: expectedArrival,
      },
    },
    updates: [
      {
        id: id("upd"),
        ticketId,
        updateType: "PARTS",
        previousStatus: call.status,
        newStatus: "WAITING_FOR_PARTS",
        message: `Waiting for part ${missingPart}. Expected ${expectedArrival.slice(0, 10)}.`,
        createdBy: actor,
        createdAt: nowIso(),
        visibleToCustomer: true,
        attachmentUrl: null,
      },
      ...store.updates,
    ],
  };
  writeStore(store);
  return transitionDispatchTicket(ticketId, "WAITING_FOR_PARTS", actor, `Missing ${missingPart}`);
}

/** PM opportunity hint when meter is near PM threshold (Patch 40/34 integration). */
export function getPmOpportunity(machineMeter: number, nextPmDueCount: number | null) {
  if (nextPmDueCount == null) return null;
  const remaining = nextPmDueCount - machineMeter;
  if (remaining <= 0) {
    return {
      level: "DUE" as const,
      message: "PM is due — confirm with technician before completing PM during this visit.",
    };
  }
  if (remaining <= 50_000) {
    return {
      level: "OPPORTUNITY" as const,
      message: `PM Opportunity — approximately ${remaining.toLocaleString()} copies until PM threshold.`,
    };
  }
  return null;
}
