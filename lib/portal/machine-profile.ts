/**
 * Patch 51B.1 — Client-safe machine profile helper (no Prisma).
 */

import {
  getPortalPrinter,
  listPortalDocuments,
  listPortalTickets,
} from "./repository";
import { listMeterTableRows } from "@/lib/pm-intelligence";
import { mapPmStatusForPortal } from "./serializers";

const CLOSED_LABELS = new Set(["Resolved", "Closed", "Cancelled"]);

export function getMachinePortalProfile(printerId: string) {
  const row = getPortalPrinter(printerId);
  if (!row.ok) return row;
  const p = row.printer;
  const tickets = listPortalTickets().filter(
    (t) =>
      t.printerId === p.id ||
      t.printerLabel.includes(p.serialNumber) ||
      t.printerLabel.includes(p.name),
  );
  const open = tickets.filter((t) => !CLOSED_LABELS.has(t.customerStatus));
  const history = tickets.filter((t) =>
    ["Resolved", "Closed"].includes(t.customerStatus),
  );
  const pm = listMeterTableRows().find((r) => r.printerId === p.id);
  const docs = listPortalDocuments().filter(
    (d) =>
      d.visibleToCustomer &&
      d.active &&
      (!d.printerId || d.printerId === p.id),
  );
  return {
    ok: true as const,
    machine: {
      id: p.id,
      name: p.name,
      model: p.model,
      serialNumber: p.serialNumber,
      locationName: p.locationName,
      status: p.status,
      lastServiceDate: p.lastServiceDate,
      lastPmDate: pm?.lastCountDate ?? null,
      nextPmDue: p.nextPmEstimate,
      nextPmMeter: pm?.nextPmCount ?? null,
      currentMeter: pm?.currentMeter ?? p.meter,
      pmStatus: pm ? mapPmStatusForPortal(pm.pmStatus) : null,
    },
    openServiceRequests: open.map((t) => ({
      id: t.id,
      ticketNumber: t.ticketNumber,
      status: t.customerStatus,
      createdAt: t.createdAt,
    })),
    serviceHistory: history.slice(0, 20).map((t) => ({
      id: t.id,
      ticketNumber: t.ticketNumber,
      status: t.customerStatus,
      updatedAt: t.updatedAt,
    })),
    documents: docs.slice(0, 20).map((d) => ({
      id: d.id,
      title: d.title,
      category: d.category,
    })),
    actions: {
      requestServiceHref: `/portal/tickets/new?printerId=${encodeURIComponent(p.id)}`,
      requestPartsHref: `/portal/parts?machineId=${encodeURIComponent(p.id)}`,
      partsBuilderHref: `/parts-order-builder?portal=1&machineId=${encodeURIComponent(p.id)}&serial=${encodeURIComponent(p.serialNumber)}`,
    },
  };
}
