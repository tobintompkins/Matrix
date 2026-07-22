/**
 * Patch 51B.1 — Canonical shared customer context for portal + internal users.
 * Aggregates existing CRM, service-call, PM, parts, document, and notification data.
 */

import { getCustomer } from "@/lib/crm/repository";
import { listServiceCalls } from "@/lib/service-calls";
import { isOpenServiceCallStatus } from "@/lib/service-calls/workflow";
import { getTicketMeta } from "@/lib/service-dispatch/repository";
import { getCustomerStatusLabel } from "./status-map";
import {
  getAuthorizedPrinterIds,
  listPortalDocuments,
  listPortalPrinters,
  listPortalTickets,
} from "./repository";
import type { CustomerMembership } from "./types";
import { listMeterTableRows } from "@/lib/pm-intelligence";
import { mapPmStatusForPortal } from "./serializers";
import { listPortalPartsRequests } from "./parts";
import { listNotifications } from "@/lib/notifications";
import {
  isPortalInboxNotificationType,
  notificationTargetsMembership,
} from "./notification-targets";

export type SharedCustomerContext = {
  customer: {
    id: string;
    name: string;
    customerNumber?: string;
    status?: string;
  } | null;
  locations: Array<{ id: string; name: string }>;
  machines: Array<{
    id: string;
    name: string;
    model: string;
    serialNumber: string;
    locationName: string;
    status: string;
    lastServiceDate: string | null;
    nextPm: string | null;
    openServiceRequests: number;
  }>;
  openServiceCalls: Array<{
    id: string;
    ticketNumber: string;
    customerStatus: string;
    source: string | null;
    machineLabel: string;
    createdAt: string;
    portalSubmitted: boolean;
  }>;
  serviceHistory: Array<{
    id: string;
    ticketNumber: string;
    customerStatus: string;
    machineLabel: string;
    closedAt: string | null;
  }>;
  pmSchedule: Array<{
    machineId: string;
    machineName: string;
    status: string;
    nextPmMeter: number | null;
    currentMeter: number | null;
    estimatedDate: string | null;
  }>;
  partsRequests: Array<{
    id: string;
    status: string;
    description: string;
    machineId: string | null;
    createdAt: string;
  }>;
  documents: Array<{ id: string; title: string; category: string }>;
  notifications: Array<{
    id: string;
    title: string;
    message: string;
    read: boolean;
    createdAt: string;
    href?: string;
  }>;
  generatedAt: string;
};

const CLOSED_LABELS = new Set(["Resolved", "Closed", "Cancelled"]);

/**
 * Build shared context for a portal membership (customer-scoped).
 */
export async function buildPortalCustomerContext(
  membership: CustomerMembership,
): Promise<SharedCustomerContext> {
  const customer = getCustomer(membership.customerId);
  const printers = listPortalPrinters();
  const tickets = listPortalTickets();
  const allowed = new Set(getAuthorizedPrinterIds(membership));

  const open = tickets.filter((t) => !CLOSED_LABELS.has(t.customerStatus));
  const closed = tickets.filter((t) =>
    ["Resolved", "Closed"].includes(t.customerStatus),
  );

  const pmRows = listMeterTableRows()
    .filter((r) => allowed.has(r.printerId))
    .map((r) => ({
      machineId: r.printerId,
      machineName: r.machineName,
      status: mapPmStatusForPortal(r.pmStatus),
      nextPmMeter: r.nextPmCount,
      currentMeter: r.currentMeter,
      estimatedDate: r.estimatedPmDate,
    }));

  let parts: SharedCustomerContext["partsRequests"] = [];
  try {
    const rows = await listPortalPartsRequests(membership);
    parts = rows.map((p) => ({
      id: p.id,
      status: p.status,
      description: p.description || "Parts request",
      machineId: p.machineId ?? null,
      createdAt: p.createdAt,
    }));
  } catch {
    parts = [];
  }

  const docs = listPortalDocuments()
    .filter((d) => d.visibleToCustomer && d.active)
    .slice(0, 50)
    .map((d) => ({
      id: d.id,
      title: d.title,
      category: d.category,
    }));

  const notifications = listNotifications()
    .filter((n) => notificationTargetsMembership(n.userIds, membership))
    .filter((n) => isPortalInboxNotificationType(n.type))
    .slice(0, 40)
    .map((n) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      read: Boolean(n.readAt),
      createdAt: n.createdAt,
      href: "/portal/notifications",
    }));

  const locations = new Map<string, string>();
  for (const p of printers) {
    locations.set(p.locationId, p.locationName);
  }

  return {
    customer: customer
      ? {
          id: customer.id,
          name: customer.name,
          customerNumber: customer.customerNumber,
          status: customer.status,
        }
      : {
          id: membership.customerId,
          name: membership.displayName,
        },
    locations: [...locations.entries()].map(([id, name]) => ({ id, name })),
    machines: printers.map((p) => ({
      id: p.id,
      name: p.name,
      model: p.model,
      serialNumber: p.serialNumber,
      locationName: p.locationName,
      status: p.status,
      lastServiceDate: p.lastServiceDate,
      nextPm: p.nextPmEstimate,
      openServiceRequests: p.openTicketCount,
    })),
    openServiceCalls: open.slice(0, 25).map((t) => {
      const meta = getTicketMeta(t.id);
      const source = meta?.source ?? null;
      return {
        id: t.id,
        ticketNumber: t.ticketNumber,
        customerStatus: t.customerStatus,
        source,
        machineLabel: t.printerLabel,
        createdAt: t.createdAt,
        portalSubmitted: source === "CUSTOMER_PORTAL",
      };
    }),
    serviceHistory: closed.slice(0, 25).map((t) => ({
      id: t.id,
      ticketNumber: t.ticketNumber,
      customerStatus: t.customerStatus,
      machineLabel: t.printerLabel,
      closedAt: t.updatedAt,
    })),
    pmSchedule: pmRows.slice(0, 25),
    partsRequests: parts.slice(0, 25),
    documents: docs,
    notifications,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Internal staff view of a customer account — same service-call records.
 */
export function buildInternalCustomerContext(customerId: string): SharedCustomerContext {
  const customer = getCustomer(customerId);
  const name = customer?.name?.toLowerCase() ?? "";
  const calls = listServiceCalls({ includeDeleted: false }).filter((c) =>
    name
      ? c.machine.customerName?.toLowerCase() === name
      : false,
  );

  const openCalls = calls.filter((c) => isOpenServiceCallStatus(c.status));
  const closedCalls = calls.filter((c) => !isOpenServiceCallStatus(c.status));

  return {
    customer: customer
      ? {
          id: customer.id,
          name: customer.name,
          customerNumber: customer.customerNumber,
          status: customer.status,
        }
      : null,
    locations: [],
    machines: [],
    openServiceCalls: openCalls.slice(0, 50).map((c) => {
      const meta = getTicketMeta(c.id);
      const source = meta?.source ?? null;
      return {
        id: c.id,
        ticketNumber: meta?.mxTicketNumber || c.ticketNumber || c.id,
        customerStatus: getCustomerStatusLabel(c.status),
        source,
        machineLabel: `${c.machine.printerModel} · ${c.machine.serialNumber}`,
        createdAt: c.createdAt,
        portalSubmitted: source === "CUSTOMER_PORTAL",
      };
    }),
    serviceHistory: closedCalls.slice(0, 50).map((c) => {
      const meta = getTicketMeta(c.id);
      return {
        id: c.id,
        ticketNumber: meta?.mxTicketNumber || c.ticketNumber || c.id,
        customerStatus: getCustomerStatusLabel(c.status),
        machineLabel: `${c.machine.printerModel} · ${c.machine.serialNumber}`,
        closedAt: c.closedAt || c.updatedAt,
      };
    }),
    pmSchedule: [],
    partsRequests: [],
    documents: [],
    notifications: [],
    generatedAt: new Date().toISOString(),
  };
}

export { getMachinePortalProfile } from "./machine-profile";
