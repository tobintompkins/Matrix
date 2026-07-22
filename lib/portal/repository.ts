import { listAssets, listSites, getCustomer } from "@/lib/crm";
import { listServiceCalls, getServiceCall, replaceServiceCall } from "@/lib/service-calls";
import {
  createDispatchTicket,
  getCustomerView,
  getMxTicketNumber,
  listTicketUpdates,
  completeTicketWithSignature,
} from "@/lib/service-dispatch";
import { notifyTicketEvent } from "@/lib/notifications";
import { portalRecipientIds } from "./notification-targets";
import { notifyPortalCustomerTicketEvent } from "./notify-customers";
import {
  assertSameCustomer,
  authorizedLocationIds,
  authorizedPrinterIds,
  hasLocationAccess,
  hasPrinterAccess,
  isMembershipActive,
  roleCanApprove,
  roleCanCreateTickets,
  roleCanManageUsers,
} from "./access";
import { getCustomerStatusLabel, buildCustomerVisibleTimeline } from "./status-map";
import { checkRateLimit, safeFileName, validatePortalUpload } from "./security";
import {
  defaultNotificationPrefs,
  PORTAL_ANNOUNCEMENTS,
  PORTAL_DOCUMENTS,
  PORTAL_FEEDBACK,
  PORTAL_INVITATIONS,
  PORTAL_LOCATION_ACCESS,
  PORTAL_MEMBERSHIPS,
  PORTAL_MESSAGES,
  PORTAL_PRINTER_ACCESS,
  PORTAL_SUPPORT_CONTACT,
} from "./seed";
import type {
  CustomerLocationAccess,
  CustomerMembership,
  CustomerPrinterAccess,
  PortalAnnouncement,
  PortalAuditEntry,
  PortalCustomerRole,
  PortalDashboardMetrics,
  PortalDocument,
  PortalFeedback,
  PortalInvitation,
  PortalLocationDto,
  PortalMessage,
  PortalNotificationPreference,
  PortalPrinterDto,
  PortalTicketDto,
  SupportContactConfig,
} from "./types";

const STORAGE_KEY = "matrix.portal.v1";

type Store = {
  memberships: CustomerMembership[];
  locationAccess: CustomerLocationAccess[];
  printerAccess: CustomerPrinterAccess[];
  invitations: PortalInvitation[];
  announcements: PortalAnnouncement[];
  documents: PortalDocument[];
  messages: PortalMessage[];
  feedback: PortalFeedback[];
  audit: PortalAuditEntry[];
  notificationPrefs: PortalNotificationPreference[];
  supportContact: SupportContactConfig;
  acknowledgedAnnouncements: string[];
  reportDownloads: Array<{ reportId: string; membershipId: string; at: string }>;
  /** Dev session: which membership is "logged in" to the portal */
  activeMembershipId: string;
};

let memory: Store | null = null;

function seedStore(): Store {
  return {
    memberships: structuredClone(PORTAL_MEMBERSHIPS),
    locationAccess: structuredClone(PORTAL_LOCATION_ACCESS),
    printerAccess: structuredClone(PORTAL_PRINTER_ACCESS),
    invitations: structuredClone(PORTAL_INVITATIONS),
    announcements: structuredClone(PORTAL_ANNOUNCEMENTS),
    documents: structuredClone(PORTAL_DOCUMENTS),
    messages: structuredClone(PORTAL_MESSAGES),
    feedback: structuredClone(PORTAL_FEEDBACK),
    audit: [],
    notificationPrefs: PORTAL_MEMBERSHIPS.map((m) => defaultNotificationPrefs(m.id)),
    supportContact: structuredClone(PORTAL_SUPPORT_CONTACT),
    acknowledgedAnnouncements: [],
    reportDownloads: [],
    activeMembershipId: "mem-sfx-admin",
  };
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof sessionStorage !== "undefined";
}

function readStore(): Store {
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
    memory = JSON.parse(raw) as Store;
    return memory;
  } catch {
    memory = seedStore();
    return memory;
  }
}

function writeStore(store: Store) {
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
  store: Store,
  entry: Omit<PortalAuditEntry, "id" | "occurredAt">,
): Store {
  return {
    ...store,
    audit: [
      { id: id("paud"), occurredAt: nowIso(), ...entry },
      ...store.audit,
    ],
  };
}

export function resetPortalForTests() {
  memory = null;
  if (canUseStorage()) sessionStorage.removeItem(STORAGE_KEY);
}

export function setActivePortalMembership(membershipId: string) {
  const store = readStore();
  const m = store.memberships.find((x) => x.id === membershipId);
  if (!m || !isMembershipActive(m)) {
    return { ok: false as const, error: "Membership not active." };
  }
  let next = {
    ...store,
    activeMembershipId: membershipId,
    memberships: store.memberships.map((x) =>
      x.id === membershipId ? { ...x, lastPortalLogin: nowIso() } : x,
    ),
  };
  next = pushAudit(next, {
    action: "PORTAL_LOGIN",
    actor: m.displayName,
    membershipId: m.id,
    customerId: m.customerId,
    entityType: "Membership",
    entityId: m.id,
    previousValue: "",
    newValue: "login",
    sessionInfo: "portal",
  });
  writeStore(next);
  return { ok: true as const, membership: m };
}

export function getActiveMembership(): CustomerMembership | null {
  const store = readStore();
  const m = store.memberships.find((x) => x.id === store.activeMembershipId);
  if (!m || !isMembershipActive(m)) return null;
  return m;
}

export function requireActiveMembership():
  | { ok: true; membership: CustomerMembership }
  | { ok: false; error: string } {
  const m = getActiveMembership();
  if (!m) return { ok: false, error: "Portal access denied. Sign in with an active membership." };
  return { ok: true, membership: m };
}

export function listMembershipsForCustomer(customerId: string) {
  return readStore().memberships.filter((m) => m.customerId === customerId);
}

export function getSupportContact() {
  return readStore().supportContact;
}

function customerSiteIds(customerId: string): string[] {
  return listSites(customerId).items.map((s) => s.id);
}

function customerAssetIds(customerId: string): string[] {
  return listAssets({ customerId }).items.map((a) => a.id);
}

export function getAuthorizedLocationIds(membership = getActiveMembership()) {
  if (!membership) return [];
  const store = readStore();
  return authorizedLocationIds(
    membership,
    store.locationAccess,
    customerSiteIds(membership.customerId),
  );
}

export function getAuthorizedPrinterIds(membership = getActiveMembership()) {
  if (!membership) return [];
  const store = readStore();
  return authorizedPrinterIds(
    membership,
    store.printerAccess,
    customerAssetIds(membership.customerId),
  );
}

export function assertLocationAccess(locationId: string) {
  const gate = requireActiveMembership();
  if (!gate.ok) return gate;
  const store = readStore();
  if (
    !hasLocationAccess(gate.membership, store.locationAccess, locationId) &&
    gate.membership.role !== "CUSTOMER_ADMIN"
  ) {
    // Admin already covered in hasLocationAccess
  }
  if (!hasLocationAccess(gate.membership, store.locationAccess, locationId)) {
    return { ok: false as const, error: "Unauthorized location." };
  }
  return { ok: true as const, membership: gate.membership };
}

export function assertPrinterAccess(printerId: string) {
  const gate = requireActiveMembership();
  if (!gate.ok) return gate;
  const store = readStore();
  if (!hasPrinterAccess(gate.membership, store.printerAccess, printerId)) {
    return { ok: false as const, error: "Unauthorized printer." };
  }
  return { ok: true as const, membership: gate.membership };
}

/** Cross-tenant guard — another customer's id must fail. */
export function assertCustomerRecord(customerId: string) {
  const gate = requireActiveMembership();
  if (!gate.ok) return gate;
  return assertSameCustomer(gate.membership, customerId);
}

export function listPortalLocations(): PortalLocationDto[] {
  const gate = requireActiveMembership();
  if (!gate.ok) return [];
  const allowed = new Set(getAuthorizedLocationIds(gate.membership));
  const sites = listSites(gate.membership.customerId).items.filter((s) =>
    allowed.has(s.id),
  );
  const assets = listAssets({ customerId: gate.membership.customerId }).items;
  const calls = listServiceCalls();

  return sites.map((s) => {
    const printers = assets.filter((a) => a.siteId === s.id);
    const open = calls.filter(
      (c) =>
        printers.some(
          (p) =>
            p.digitalTwinId?.toLowerCase() === c.machine.machineId.toLowerCase() ||
            p.assetNumber === c.machine.assetTag,
        ) && !["CLOSED", "CANCELLED", "RESOLVED"].includes(c.status),
    );
    return {
      id: s.id,
      name: s.name,
      address: s.physicalAddress,
      printerCount: printers.length,
      openTicketCount: open.length,
      upcomingPmCount: 1,
      status: "Active",
    };
  });
}

export function getPortalLocation(locationId: string) {
  const access = assertLocationAccess(locationId);
  if (!access.ok) return { ok: false as const, error: access.error };
  const loc = listPortalLocations().find((l) => l.id === locationId);
  if (!loc) return { ok: false as const, error: "Location not found." };
  return { ok: true as const, location: loc, membership: access.membership };
}

export function listPortalPrinters(filters?: {
  locationId?: string;
  search?: string;
  model?: string;
}): PortalPrinterDto[] {
  const gate = requireActiveMembership();
  if (!gate.ok) return [];
  const allowed = new Set(getAuthorizedPrinterIds(gate.membership));
  const assets = listAssets({ customerId: gate.membership.customerId }).items.filter(
    (a) => allowed.has(a.id),
  );
  const sites = listSites(gate.membership.customerId).items;
  const calls = listServiceCalls();
  const q = filters?.search?.trim().toLowerCase() ?? "";

  return assets
    .filter((a) => !filters?.locationId || a.siteId === filters.locationId)
    .filter((a) => !filters?.model || a.model === filters.model)
    .filter((a) => {
      if (!q) return true;
      return (
        a.nickname.toLowerCase().includes(q) ||
        a.serialNumber.toLowerCase().includes(q) ||
        a.assetNumber.toLowerCase().includes(q)
      );
    })
    .map((a) => {
      const site = sites.find((s) => s.id === a.siteId);
      const openTicketCount = calls.filter(
        (c) =>
          (c.machine.machineId.toLowerCase() === (a.digitalTwinId ?? "").toLowerCase() ||
            c.machine.assetTag === a.assetNumber) &&
          !["CLOSED", "CANCELLED", "RESOLVED"].includes(c.status),
      ).length;
      return {
        id: a.id,
        name: a.nickname || a.assetNumber,
        model: a.model,
        serialNumber: a.serialNumber,
        locationId: a.siteId,
        locationName: site?.name ?? "",
        status: a.status,
        meter: gate.membership.canViewMeters ? a.currentCopyCount : null,
        lastServiceDate: a.installDate,
        nextPmEstimate: gate.membership.canViewPm ? "Due soon" : null,
        openTicketCount,
        coverageStatus: "Under contract",
      };
    });
}

export function getPortalPrinter(printerId: string) {
  const access = assertPrinterAccess(printerId);
  if (!access.ok) return { ok: false as const, error: access.error };
  const printer = listPortalPrinters().find((p) => p.id === printerId);
  if (!printer) return { ok: false as const, error: "Printer not found." };
  return { ok: true as const, printer, membership: access.membership };
}

function ticketTouchesAuthorizedPrinter(
  callId: string,
  membership: CustomerMembership,
): boolean {
  const call = getServiceCall(callId);
  if (!call) return false;
  const allowed = getAuthorizedPrinterIds(membership);
  const assets = listAssets({ customerId: membership.customerId }).items.filter((a) =>
    allowed.includes(a.id),
  );
  return assets.some(
    (a) =>
      a.digitalTwinId?.toLowerCase() === call.machine.machineId.toLowerCase() ||
      a.assetNumber === call.machine.assetTag ||
      a.serialNumber === call.machine.serialNumber,
  );
}

export function listPortalTickets(filters?: {
  statusGroup?: string;
  search?: string;
}): PortalTicketDto[] {
  const gate = requireActiveMembership();
  if (!gate.ok) return [];
  const calls = listServiceCalls().filter((c) =>
    ticketTouchesAuthorizedPrinter(c.id, gate.membership),
  );

  return calls
    .filter((c) => {
      const g = filters?.statusGroup;
      if (!g || g === "ALL") return true;
      if (g === "OPEN") return !["CLOSED", "CANCELLED", "RESOLVED"].includes(c.status);
      if (g === "SCHEDULED") return ["SCHEDULED", "ACCEPTED", "ASSIGNED"].includes(c.status);
      if (g === "WAITING_FOR_PARTS") return c.status === "WAITING_FOR_PARTS";
      if (g === "RESOLVED") return c.status === "RESOLVED" || c.status === "CLOSED";
      return true;
    })
    .filter((c) => {
      const q = filters?.search?.trim().toLowerCase() ?? "";
      if (!q) return true;
      return (
        c.ticketNumber.toLowerCase().includes(q) ||
        c.problem.issueTitle.toLowerCase().includes(q) ||
        c.machine.serialNumber.toLowerCase().includes(q)
      );
    })
    .map((c) => {
      const view = getCustomerView(c.id);
      return {
        id: c.id,
        ticketNumber: view?.ticketNumber ?? getMxTicketNumber(c.id),
        printerId: c.machine.machineId,
        printerLabel: `${c.machine.printerModel} · ${c.machine.serialNumber}`,
        locationName: c.machine.siteName,
        problemTitle: c.problem.issueTitle,
        customerStatus: getCustomerStatusLabel(c.status),
        priority: c.priority,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        scheduledWindow: view?.scheduledWindow ?? "",
        technicianName: view?.technicianName ?? "",
        resolutionSummary: view?.resolutionSummary ?? "",
        partsDelay: view?.partsDelay ?? "",
      };
    });
}

export function getPortalTicket(ticketId: string) {
  const gate = requireActiveMembership();
  if (!gate.ok) return { ok: false as const, error: gate.error };
  if (!ticketTouchesAuthorizedPrinter(ticketId, gate.membership)) {
    return { ok: false as const, error: "Unauthorized ticket." };
  }
  const dto = listPortalTickets().find((t) => t.id === ticketId);
  if (!dto) return { ok: false as const, error: "Ticket not found." };

  let store = readStore();
  store = pushAudit(store, {
    action: "TICKET_VIEWED",
    actor: gate.membership.displayName,
    membershipId: gate.membership.id,
    customerId: gate.membership.customerId,
    entityType: "Ticket",
    entityId: ticketId,
    previousValue: "",
    newValue: dto.ticketNumber,
    sessionInfo: "portal",
  });
  writeStore(store);

  const updates = listTicketUpdates(ticketId).filter((u) => u.visibleToCustomer);
  const messages = store.messages.filter(
    (m) => m.ticketId === ticketId && m.visibleToCustomer,
  );
  const timeline = buildCustomerVisibleTimeline(updates);
  return {
    ok: true as const,
    ticket: dto,
    activity: timeline.map((a) => ({
      at: a.at,
      label: a.label,
      code: a.code,
      message: a.message,
    })),
    messages,
    membership: gate.membership,
  };
}

export function createPortalTicket(input: {
  printerAssetId: string;
  problemCategory: string;
  problemTitle: string;
  description: string;
  productionImpact: string;
  machineOperational: boolean;
  errorCode: string;
  preferredDate: string;
  preferredWindow: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  confirmSeparateProblem?: boolean;
}) {
  const gate = requireActiveMembership();
  if (!gate.ok) return { ok: false as const, error: gate.error };
  if (!roleCanCreateTickets(gate.membership.role)) {
    return { ok: false as const, error: "Read-only users cannot create tickets." };
  }

  const rate = checkRateLimit(`ticket:${gate.membership.id}`, 10, 60_000);
  if (!rate.ok) return { ok: false as const, error: rate.error };

  const access = assertPrinterAccess(input.printerAssetId);
  if (!access.ok) return { ok: false as const, error: access.error };

  const assets = listAssets({ customerId: gate.membership.customerId }).items;
  const asset = assets.find((a) => a.id === input.printerAssetId);
  if (!asset) return { ok: false as const, error: "Printer not found." };

  const machineId = (asset.digitalTwinId ?? asset.assetNumber).toLowerCase();
  const openExisting = listServiceCalls().filter(
    (c) =>
      c.machine.machineId.toLowerCase() === machineId &&
      !["CLOSED", "CANCELLED", "RESOLVED"].includes(c.status),
  );
  if (openExisting.length > 0 && !input.confirmSeparateProblem) {
    return {
      ok: false as const,
      error: "An open ticket already exists for this printer. Confirm it is a separate problem to continue.",
      existingTicketIds: openExisting.map((c) => c.id),
      requiresConfirmation: true as const,
    };
  }

  const priority =
    input.productionImpact === "Production stopped" ||
    input.productionImpact === "Machine down"
      ? ("CRITICAL" as const)
      : input.productionImpact === "Partially operational"
        ? ("HIGH" as const)
        : ("NORMAL" as const);

  const created = createDispatchTicket({
    machineId,
    serviceType: "BREAK_FIX",
    issueTitle: input.problemTitle,
    problemDescription: input.description,
    errorCode: input.errorCode,
    symptoms: input.productionImpact,
    customerImpact: input.productionImpact,
    machineCurrentlyDown: !input.machineOperational,
    priority,
    reportedBy: input.contactName || gate.membership.displayName,
    reporterPhone: input.contactPhone || gate.membership.phone,
    reporterEmail: input.contactEmail || gate.membership.email,
    technician: "",
    serviceManager: "",
    organization: getCustomer(gate.membership.customerId)?.name ?? "",
    region: "",
    requestedServiceDate: input.preferredDate,
    scheduledStart: input.preferredWindow || input.preferredDate,
    estimatedDurationHours: 2,
    isDraft: false,
    createdBy: gate.membership.displayName,
    category: input.problemCategory,
    source: "CUSTOMER_PORTAL",
  });

  if (!created.ok) return { ok: false as const, error: created.error ?? "Create failed." };

  let store = readStore();
  store = pushAudit(store, {
    action: "TICKET_CREATED",
    actor: gate.membership.displayName,
    membershipId: gate.membership.id,
    customerId: gate.membership.customerId,
    entityType: "Ticket",
    entityId: created.call.id,
    previousValue: "",
    newValue: created.ticketNumber,
    sessionInfo: "portal",
  });
  writeStore(store);

  notifyPortalCustomerTicketEvent({
    customerId: gate.membership.customerId,
    type: "TICKET_CREATED",
    title: `Ticket ${created.ticketNumber} submitted`,
    message: input.problemTitle,
    ticketId: created.call.id,
    ticketNumber: created.ticketNumber,
    customerName: getCustomer(gate.membership.customerId)?.name ?? "",
    alsoNotify: ["Dispatcher"],
  });

  return {
    ok: true as const,
    ticketId: created.call.id,
    ticketNumber: created.ticketNumber,
  };
}

export function addPortalMessage(input: {
  ticketId: string;
  body: string;
  attachmentName?: string;
  mimeType?: string;
  sizeBytes?: number;
}) {
  const detail = getPortalTicket(input.ticketId);
  if (!detail.ok) return { ok: false as const, error: detail.error };
  if (!roleCanCreateTickets(detail.membership.role) && detail.membership.role === "CUSTOMER_VIEWER") {
    // viewers can still message? Spec says CUSTOMER_VIEWER cannot create/update tickets — messaging is update-ish
    // Allow comments for USER+ only
  }
  if (detail.membership.role === "CUSTOMER_VIEWER") {
    return { ok: false as const, error: "Read-only users cannot post messages." };
  }

  const rate = checkRateLimit(`msg:${detail.membership.id}`, 30, 60_000);
  if (!rate.ok) return { ok: false as const, error: rate.error };

  if (input.mimeType && input.sizeBytes != null) {
    const fileGate = validatePortalUpload(input.mimeType, input.sizeBytes);
    if (!fileGate.ok) return { ok: false as const, error: fileGate.error };
  }

  const msg: PortalMessage = {
    id: id("pmsg"),
    ticketId: input.ticketId,
    membershipId: detail.membership.id,
    senderDisplayName: detail.membership.displayName,
    body: input.body.trim(),
    createdAt: nowIso(),
    visibleToCustomer: true,
    attachmentName: input.attachmentName ? safeFileName(input.attachmentName) : null,
    readByCustomer: true,
  };

  let store = readStore();
  store = {
    ...store,
    messages: [msg, ...store.messages],
  };
  store = pushAudit(store, {
    action: "CUSTOMER_MESSAGE_ADDED",
    actor: detail.membership.displayName,
    membershipId: detail.membership.id,
    customerId: detail.membership.customerId,
    entityType: "Ticket",
    entityId: input.ticketId,
    previousValue: "",
    newValue: msg.body.slice(0, 80),
    sessionInfo: "portal",
  });
  writeStore(store);

  notifyTicketEvent({
    type: "CUSTOMER_RESPONSE",
    title: `Customer message on ${detail.ticket.ticketNumber}`,
    message: msg.body.slice(0, 120),
    ticketId: input.ticketId,
    ticketNumber: detail.ticket.ticketNumber,
    userIds: ["Dispatcher", "Service Manager"],
  });

  return { ok: true as const, message: msg };
}

export function approvePortalWork(input: {
  ticketId: string;
  signature: string;
  comment?: string;
  unresolved?: boolean;
}) {
  const detail = getPortalTicket(input.ticketId);
  if (!detail.ok) return { ok: false as const, error: detail.error };
  if (!roleCanApprove(detail.membership)) {
    return { ok: false as const, error: "You do not have approval permission." };
  }

  if (input.unresolved) {
    const call = getServiceCall(input.ticketId);
    if (call) {
      replaceServiceCall({
        ...call,
        status: "DIAGNOSING",
        closedAt: "",
        resolution: {
          ...call.resolution,
          followUpRequired: true,
          technicianRecommendations: input.comment || "Customer reported issue not resolved",
        },
      });
    }
    notifyTicketEvent({
      type: "TICKET_REOPENED",
      title: `${detail.ticket.ticketNumber} — customer rejected completion`,
      message: input.comment || "Issue not resolved",
      ticketId: input.ticketId,
      ticketNumber: detail.ticket.ticketNumber,
      priority: "HIGH",
      userIds: ["Service Manager"],
    });
    let store = readStore();
    store = pushAudit(store, {
      action: "WORK_REJECTED",
      actor: detail.membership.displayName,
      membershipId: detail.membership.id,
      customerId: detail.membership.customerId,
      entityType: "Ticket",
      entityId: input.ticketId,
      previousValue: "RESOLVED",
      newValue: "REOPENED",
      sessionInfo: "portal",
    });
    writeStore(store);
    return { ok: true as const, rejected: true as const };
  }

  const result = completeTicketWithSignature({
    ticketId: input.ticketId,
    meterAtClose: 0,
    resolutionSummary:
      getServiceCall(input.ticketId)?.resolution.resolutionSummary || "Customer approved",
    workPerformed: getServiceCall(input.ticketId)?.resolution.workPerformed || "Approved",
    testResults: "Customer approved",
    finalCondition: "OPERATIONAL",
    technicianName: detail.ticket.technicianName || "Technician",
    customerContactName: detail.membership.displayName,
    customerSignature: input.signature,
    actor: detail.membership.displayName,
  });

  if (!result.ok) return { ok: false as const, error: result.error };

  let store = readStore();
  store = pushAudit(store, {
    action: "WORK_APPROVED",
    actor: detail.membership.displayName,
    membershipId: detail.membership.id,
    customerId: detail.membership.customerId,
    entityType: "Ticket",
    entityId: input.ticketId,
    previousValue: "",
    newValue: "approved",
    sessionInfo: "portal",
  });
  writeStore(store);
  return { ok: true as const, rejected: false as const, reportHtml: result.reportHtml };
}

export function submitPortalFeedback(input: {
  ticketId: string;
  rating: number;
  resolutionSatisfaction: number;
  technicianProfessionalism: number;
  communicationQuality: number;
  responseTimeSatisfaction: number;
  comment: string;
  followUpRequested: boolean;
}) {
  const detail = getPortalTicket(input.ticketId);
  if (!detail.ok) return { ok: false as const, error: detail.error };
  if (input.rating < 1 || input.rating > 5) {
    return { ok: false as const, error: "Rating must be 1–5." };
  }

  const store = readStore();
  const existing = store.feedback.find(
    (f) => f.ticketId === input.ticketId && f.membershipId === detail.membership.id,
  );
  if (existing) {
    return { ok: false as const, error: "Feedback already submitted for this ticket." };
  }

  const rate = checkRateLimit(`fb:${detail.membership.id}`, 5, 60_000);
  if (!rate.ok) return { ok: false as const, error: rate.error };

  const row: PortalFeedback = {
    id: id("pfb"),
    ticketId: input.ticketId,
    membershipId: detail.membership.id,
    rating: input.rating,
    resolutionSatisfaction: input.resolutionSatisfaction,
    technicianProfessionalism: input.technicianProfessionalism,
    communicationQuality: input.communicationQuality,
    responseTimeSatisfaction: input.responseTimeSatisfaction,
    comment: input.comment,
    followUpRequested: input.followUpRequested,
    submittedAt: nowIso(),
  };

  let next = { ...store, feedback: [row, ...store.feedback] };
  next = pushAudit(next, {
    action: "FEEDBACK_SUBMITTED",
    actor: detail.membership.displayName,
    membershipId: detail.membership.id,
    customerId: detail.membership.customerId,
    entityType: "Ticket",
    entityId: input.ticketId,
    previousValue: "",
    newValue: String(input.rating),
    sessionInfo: "portal",
  });
  writeStore(next);

  if (input.rating <= 2) {
    notifyTicketEvent({
      type: "CUSTOMER_RESPONSE",
      title: `Low rating on ${detail.ticket.ticketNumber}`,
      message: `Customer rated ${input.rating}/5`,
      ticketId: input.ticketId,
      ticketNumber: detail.ticket.ticketNumber,
      priority: "HIGH",
      userIds: ["Service Manager"],
    });
  }

  return { ok: true as const, feedback: row };
}

export function listPortalAnnouncements() {
  const gate = requireActiveMembership();
  if (!gate.ok) return [];
  const locs = new Set(getAuthorizedLocationIds(gate.membership));
  return readStore().announcements.filter(
    (a) =>
      a.visible &&
      a.customerId === gate.membership.customerId &&
      (!a.locationId || locs.has(a.locationId)),
  );
}

export function listPortalDocuments(filters?: { category?: string; search?: string }) {
  const gate = requireActiveMembership();
  if (!gate.ok) return [];
  const locs = new Set(getAuthorizedLocationIds(gate.membership));
  const printers = new Set(getAuthorizedPrinterIds(gate.membership));
  const q = filters?.search?.trim().toLowerCase() ?? "";

  return readStore()
    .documents.filter(
      (d) =>
        d.visibleToCustomer &&
        d.active &&
        d.customerId === gate.membership.customerId &&
        (!d.locationId || locs.has(d.locationId)) &&
        (!d.printerId || printers.has(d.printerId)),
    )
    .filter((d) => !filters?.category || d.category === filters.category)
    .filter(
      (d) =>
        !q ||
        d.title.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q),
    );
}

export function downloadPortalDocument(documentId: string) {
  const gate = requireActiveMembership();
  if (!gate.ok) return { ok: false as const, error: gate.error };
  const doc = listPortalDocuments().find((d) => d.id === documentId);
  if (!doc) return { ok: false as const, error: "Document not authorized." };

  let store = readStore();
  store = {
    ...store,
    reportDownloads: [
      { reportId: documentId, membershipId: gate.membership.id, at: nowIso() },
      ...store.reportDownloads,
    ],
  };
  store = pushAudit(store, {
    action: "DOCUMENT_DOWNLOADED",
    actor: gate.membership.displayName,
    membershipId: gate.membership.id,
    customerId: gate.membership.customerId,
    entityType: "Document",
    entityId: documentId,
    previousValue: "",
    newValue: doc.title,
    sessionInfo: "portal",
  });
  writeStore(store);
  return { ok: true as const, document: doc };
}

export function listPortalReports() {
  const tickets = listPortalTickets({ statusGroup: "RESOLVED" });
  const gate = requireActiveMembership();
  if (!gate.ok || !gate.membership.canDownloadReports) return [];
  return tickets.map((t) => ({
    id: t.id,
    reportDate: t.updatedAt,
    reportType: "Service Report",
    ticketNumber: t.ticketNumber,
    printer: t.printerLabel,
    location: t.locationName,
    technician: t.technicianName,
  }));
}

export function getPortalDashboard(): PortalDashboardMetrics | null {
  const gate = requireActiveMembership();
  if (!gate.ok) return null;
  const printers = listPortalPrinters();
  const tickets = listPortalTickets();
  const open = tickets.filter((t) =>
    !["Resolved", "Closed", "Cancelled"].includes(t.customerStatus),
  );
  const month = new Date().toISOString().slice(0, 7);
  return {
    activePrinters: printers.filter((p) => p.status === "ACTIVE").length,
    openTickets: open.length,
    criticalTickets: tickets.filter((t) => t.priority === "CRITICAL" || t.priority === "URGENT" || t.priority === "EMERGENCY").length,
    technicianScheduled: tickets.filter((t) => t.customerStatus === "Service Scheduled").length,
    waitingForParts: tickets.filter((t) => t.customerStatus === "Waiting for Parts").length,
    resolvedThisMonth: tickets.filter(
      (t) =>
        (t.customerStatus === "Resolved" || t.customerStatus === "Closed") &&
        t.updatedAt.startsWith(month),
    ).length,
    upcomingPMs: gate.membership.canViewPm ? printers.length : 0,
    overduePMs: 0,
    printersWithAlerts: printers.filter((p) => p.openTicketCount > 0).length,
    newDocuments: listPortalDocuments().length,
    unreadNotifications: 0,
  };
}

export function createInvitation(input: {
  email: string;
  displayName: string;
  role: PortalCustomerRole;
  locationIds: string[];
  printerIds: string[];
  canApproveService: boolean;
  canViewMeters: boolean;
  canViewPm: boolean;
  canDownloadReports: boolean;
  canManageUsers: boolean;
}) {
  const gate = requireActiveMembership();
  if (!gate.ok) return { ok: false as const, error: gate.error };
  if (!roleCanManageUsers(gate.membership)) {
    return { ok: false as const, error: "Not permitted to manage users." };
  }

  const rate = checkRateLimit(`inv:${gate.membership.id}`, 5, 60_000);
  if (!rate.ok) return { ok: false as const, error: rate.error };

  const store = readStore();
  const dup = store.invitations.find(
    (i) =>
      i.email.toLowerCase() === input.email.toLowerCase() &&
      i.customerId === gate.membership.customerId &&
      i.status === "PENDING",
  );
  if (dup) return { ok: false as const, error: "A pending invitation already exists for this email." };

  // Cannot grant permissions the inviter does not have
  if (input.canManageUsers && !gate.membership.canManageUsers) {
    return { ok: false as const, error: "Cannot grant permissions you do not possess." };
  }

  const inv: PortalInvitation = {
    id: id("inv"),
    email: input.email.trim(),
    displayName: input.displayName.trim(),
    customerId: gate.membership.customerId,
    role: input.role,
    status: "PENDING",
    invitedBy: gate.membership.displayName,
    invitedAt: nowIso(),
    expiresAt: new Date(Date.now() + 14 * 86_400_000).toISOString(),
    acceptedAt: null,
    cancelledAt: null,
    locationIds: input.locationIds,
    printerIds: input.printerIds,
    canApproveService: input.canApproveService && gate.membership.canApproveService,
    canViewMeters: input.canViewMeters && gate.membership.canViewMeters,
    canViewPm: input.canViewPm && gate.membership.canViewPm,
    canDownloadReports: input.canDownloadReports && gate.membership.canDownloadReports,
    canManageUsers: input.canManageUsers && gate.membership.canManageUsers,
  };

  let next = { ...store, invitations: [inv, ...store.invitations] };
  next = pushAudit(next, {
    action: "INVITATION_CREATED",
    actor: gate.membership.displayName,
    membershipId: gate.membership.id,
    customerId: gate.membership.customerId,
    entityType: "Invitation",
    entityId: inv.id,
    previousValue: "",
    newValue: inv.email,
    sessionInfo: "portal",
  });
  writeStore(next);
  return { ok: true as const, invitation: inv };
}

export function acceptInvitation(invitationId: string, clerkUserId: string) {
  const store = readStore();
  const inv = store.invitations.find((i) => i.id === invitationId);
  if (!inv) return { ok: false as const, error: "Invitation not found." };
  if (inv.status !== "PENDING") return { ok: false as const, error: "Invitation is not pending." };
  if (new Date(inv.expiresAt) < new Date()) {
    return { ok: false as const, error: "Invitation has expired." };
  }

  const membership: CustomerMembership = {
    id: id("mem"),
    clerkUserId,
    email: inv.email,
    displayName: inv.displayName,
    customerId: inv.customerId,
    role: inv.role,
    status: "ACTIVE",
    invitedBy: inv.invitedBy,
    invitedAt: inv.invitedAt,
    acceptedAt: nowIso(),
    disabledAt: null,
    lastPortalLogin: null,
    canApproveService: inv.canApproveService,
    canViewMeters: inv.canViewMeters,
    canViewPm: inv.canViewPm,
    canDownloadReports: inv.canDownloadReports,
    canManageUsers: inv.canManageUsers,
    jobTitle: "",
    phone: "",
    preferredContactMethod: "EMAIL",
    timeZone: "America/New_York",
    defaultLocationId: inv.locationIds[0] ?? null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  const locationAccess: CustomerLocationAccess[] = inv.locationIds.map((locationId) => ({
    id: id("pla"),
    membershipId: membership.id,
    locationId,
    accessLevel: "WRITE" as const,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }));
  const printerAccess: CustomerPrinterAccess[] = inv.printerIds.map((printerId) => ({
    id: id("ppa"),
    membershipId: membership.id,
    printerId,
    accessLevel: "WRITE" as const,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }));

  let next: Store = {
    ...store,
    memberships: [membership, ...store.memberships],
    locationAccess: [...locationAccess, ...store.locationAccess],
    printerAccess: [...printerAccess, ...store.printerAccess],
    invitations: store.invitations.map((i) =>
      i.id === invitationId
        ? { ...i, status: "ACCEPTED" as const, acceptedAt: nowIso() }
        : i,
    ),
    notificationPrefs: [
      defaultNotificationPrefs(membership.id),
      ...store.notificationPrefs,
    ],
  };
  next = pushAudit(next, {
    action: "INVITATION_ACCEPTED",
    actor: membership.displayName,
    membershipId: membership.id,
    customerId: membership.customerId,
    entityType: "Invitation",
    entityId: invitationId,
    previousValue: "PENDING",
    newValue: "ACCEPTED",
    sessionInfo: "portal",
  });
  writeStore(next);
  return { ok: true as const, membership };
}

export function disableMembership(membershipId: string) {
  const gate = requireActiveMembership();
  if (!gate.ok) return { ok: false as const, error: gate.error };
  if (!roleCanManageUsers(gate.membership)) {
    return { ok: false as const, error: "Not permitted." };
  }
  const store = readStore();
  const target = store.memberships.find((m) => m.id === membershipId);
  if (!target || target.customerId !== gate.membership.customerId) {
    return { ok: false as const, error: "User not found in your organization." };
  }
  let next = {
    ...store,
    memberships: store.memberships.map((m) =>
      m.id === membershipId
        ? { ...m, status: "DISABLED" as const, disabledAt: nowIso() }
        : m,
    ),
  };
  next = pushAudit(next, {
    action: "USER_DISABLED",
    actor: gate.membership.displayName,
    membershipId: gate.membership.id,
    customerId: gate.membership.customerId,
    entityType: "Membership",
    entityId: membershipId,
    previousValue: "ACTIVE",
    newValue: "DISABLED",
    sessionInfo: "portal",
  });
  writeStore(next);
  return { ok: true as const };
}

export function listPendingInvitations() {
  const gate = requireActiveMembership();
  if (!gate.ok || !roleCanManageUsers(gate.membership)) return [];
  return readStore().invitations.filter(
    (i) => i.customerId === gate.membership.customerId && i.status === "PENDING",
  );
}

export function getNotificationPrefs() {
  const gate = requireActiveMembership();
  if (!gate.ok) return null;
  return (
    readStore().notificationPrefs.find((p) => p.membershipId === gate.membership.id) ??
    defaultNotificationPrefs(gate.membership.id)
  );
}

export function saveNotificationPrefs(patch: Partial<PortalNotificationPreference>) {
  const gate = requireActiveMembership();
  if (!gate.ok) return { ok: false as const, error: gate.error };
  const store = readStore();
  const existing =
    store.notificationPrefs.find((p) => p.membershipId === gate.membership.id) ??
    defaultNotificationPrefs(gate.membership.id);
  const updated = { ...existing, ...patch, membershipId: gate.membership.id, updatedAt: nowIso() };
  let next = {
    ...store,
    notificationPrefs: [
      updated,
      ...store.notificationPrefs.filter((p) => p.membershipId !== gate.membership.id),
    ],
  };
  next = pushAudit(next, {
    action: "NOTIFICATION_PREFERENCE_CHANGED",
    actor: gate.membership.displayName,
    membershipId: gate.membership.id,
    customerId: gate.membership.customerId,
    entityType: "Preferences",
    entityId: gate.membership.id,
    previousValue: "",
    newValue: JSON.stringify(patch),
    sessionInfo: "portal",
  });
  writeStore(next);
  return { ok: true as const, prefs: updated };
}

export function requestPmScheduling(printerId: string, note: string) {
  const access = assertPrinterAccess(printerId);
  if (!access.ok) return { ok: false as const, error: access.error };
  if (!access.membership.canViewPm) {
    return { ok: false as const, error: "PM visibility not permitted." };
  }
  let store = readStore();
  store = pushAudit(store, {
    action: "PM_SCHEDULING_REQUESTED",
    actor: access.membership.displayName,
    membershipId: access.membership.id,
    customerId: access.membership.customerId,
    entityType: "Printer",
    entityId: printerId,
    previousValue: "",
    newValue: note,
    sessionInfo: "portal",
  });
  writeStore(store);
  notifyPortalCustomerTicketEvent({
    customerId: access.membership.customerId,
    type: "SCHEDULE_CHANGED",
    title: "PM scheduling requested",
    message: note || `PM requested for ${printerId}`,
    ticketId: printerId,
    ticketNumber: "PM-REQUEST",
    alsoNotify: ["Dispatcher"],
  });
  return { ok: true as const };
}

export function listPortalAudit(limit = 50) {
  return readStore().audit.slice(0, limit);
}

export function listAllMembershipsAdmin() {
  return readStore().memberships;
}

export function getPortalProfile() {
  return getActiveMembership();
}

export function updatePortalProfile(patch: {
  phone?: string;
  jobTitle?: string;
  preferredContactMethod?: CustomerMembership["preferredContactMethod"];
  timeZone?: string;
  defaultLocationId?: string | null;
}) {
  const gate = requireActiveMembership();
  if (!gate.ok) return { ok: false as const, error: gate.error };
  const store = readStore();
  const updated = {
    ...gate.membership,
    ...patch,
    // Never allow org/role/access changes from profile
    customerId: gate.membership.customerId,
    role: gate.membership.role,
    canApproveService: gate.membership.canApproveService,
    canManageUsers: gate.membership.canManageUsers,
    updatedAt: nowIso(),
  };
  writeStore({
    ...store,
    memberships: store.memberships.map((m) =>
      m.id === gate.membership.id ? updated : m,
    ),
  });
  return { ok: true as const, membership: updated };
}

/** Attempt cross-customer access — used by tests. */
export function attemptCrossCustomerTicketAccess(
  membershipId: string,
  foreignTicketId: string,
) {
  setActivePortalMembership(membershipId);
  return getPortalTicket(foreignTicketId);
}
