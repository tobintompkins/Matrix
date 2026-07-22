/**
 * Patch 51B — Customer-safe serializers (allowlist only; never raw ORM objects).
 */

import { getCustomerStatusLabel } from "./status-map";
import type { PortalTicketDto, PortalPrinterDto, PortalDocument } from "./types";

const INTERNAL_FIELDS = [
  "internalNotes",
  "privateNotes",
  "laborCost",
  "partsCost",
  "margin",
  "managementDiscussion",
  "inventoryLocation",
  "securityNotes",
  "warrantyRecovery",
  "employeePerformance",
] as const;

export function assertNoInternalLeak(payload: unknown): void {
  const raw = JSON.stringify(payload ?? {});
  for (const field of INTERNAL_FIELDS) {
    if (raw.includes(`"${field}"`)) {
      throw new Error(`Internal field "${field}" must not appear in portal payloads.`);
    }
  }
}

export function serializePortalTicket(
  ticket: PortalTicketDto,
  opts?: { showTechnicianName?: boolean; showScheduledWindow?: boolean },
) {
  const out = {
    id: ticket.id,
    serviceNumber: ticket.ticketNumber,
    ticketNumber: ticket.ticketNumber,
    machineId: ticket.printerId,
    machineLabel: ticket.printerLabel,
    locationName: ticket.locationName,
    issueSummary: ticket.problemTitle,
    status: ticket.customerStatus,
    priority: ticket.priority,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    scheduledVisit: opts?.showScheduledWindow === false ? null : ticket.scheduledWindow,
    assignedServiceTeam:
      opts?.showTechnicianName === false ? null : ticket.technicianName,
    resolutionSummary: ticket.resolutionSummary,
    partsDelay: ticket.partsDelay,
  };
  assertNoInternalLeak(out);
  return out;
}

export function serializePortalEquipment(
  printer: PortalPrinterDto,
  opts?: { includeMeter?: boolean },
) {
  const out = {
    id: printer.id,
    name: printer.name,
    model: printer.model,
    serialNumber: printer.serialNumber,
    locationId: printer.locationId,
    locationName: printer.locationName,
    operationalStatus: mapEquipmentStatus(printer.status),
    lastServiceDate: printer.lastServiceDate,
    nextPm: printer.nextPmEstimate,
    meterReading: opts?.includeMeter === false ? null : printer.meter,
    warrantyStatus: printer.coverageStatus,
    openServiceRequests: printer.openTicketCount,
  };
  assertNoInternalLeak(out);
  return out;
}

export function mapEquipmentStatus(status: string): string {
  const s = status.toUpperCase();
  if (s.includes("DOWN") || s.includes("OUT")) return "Out of Service";
  if (s.includes("SCHEDULE")) return "Service Scheduled";
  if (s.includes("SERVICE") || s.includes("DEGRADED") || s.includes("ATTENTION")) {
    return "Service Recommended";
  }
  if (s.includes("ONLINE") || s.includes("OPERATIONAL") || s.includes("GOOD")) {
    return "Operational";
  }
  return "Unknown";
}

export function serializePortalDocument(doc: PortalDocument) {
  if (!doc.visibleToCustomer || !doc.active) {
    throw new Error("Document is not available.");
  }
  const out = {
    id: doc.id,
    name: doc.title,
    description: doc.description,
    category: doc.category,
    machineId: doc.printerId,
    locationId: doc.locationId,
    uploadedAt: doc.uploadedAt,
    expirationDate: doc.expirationDate,
    uploadedBy: doc.uploadedBy,
    version: doc.version,
    // Never expose raw private storage paths in list payloads — download via authorized route
    canDownload: Boolean(doc.fileUrl),
  };
  assertNoInternalLeak(out);
  return out;
}

export function serializeInternalStatusForPortal(internalStatus: string) {
  return getCustomerStatusLabel(internalStatus);
}

export function mapPartsStatusForPortal(internal: string): string {
  const map: Record<string, string> = {
    DRAFT: "Submitted",
    SUBMITTED: "Submitted",
    PENDING: "Under Review",
    UNDER_REVIEW: "Under Review",
    APPROVED: "Approved",
    ORDERED: "Ordered",
    PARTIALLY_SHIPPED: "Partially Shipped",
    SHIPPED: "Shipped",
    DELIVERED: "Delivered",
    RECEIVED: "Delivered",
    REJECTED: "Rejected",
    CANCELLED: "Cancelled",
  };
  return map[internal] ?? "Under Review";
}

export function mapPmStatusForPortal(internal: string): string {
  const s = internal.toUpperCase();
  if (s.includes("OVERDUE")) return "Overdue";
  if (s.includes("DUE_SOON") || s.includes("DUE SOON")) return "Due Soon";
  if (s.includes("SCHEDULE")) return "Scheduled";
  if (s.includes("COMPLETE")) return "Completed";
  if (s.includes("CANCEL")) return "Cancelled";
  return "Upcoming";
}
