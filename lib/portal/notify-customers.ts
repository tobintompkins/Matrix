/**
 * Patch 51B.1 — Notify portal memberships for a CRM customer (Hub → portal).
 */

import { notifyTicketEvent } from "@/lib/notifications";
import type { NotificationType } from "@/lib/notifications/types";
import { getCustomer } from "@/lib/crm/repository";
import {
  listAllMembershipsAdmin,
  listMembershipsForCustomer,
} from "./repository";
import { portalRecipientIds } from "./notification-targets";

function membershipsForCustomerId(customerId: string) {
  return listMembershipsForCustomer(customerId).filter(
    (m) => m.status === "ACTIVE",
  );
}

function membershipsForCustomerName(customerName: string) {
  const name = customerName.trim().toLowerCase();
  if (!name) return [];
  return listAllMembershipsAdmin().filter((m) => {
    if (m.status !== "ACTIVE") return false;
    const c = getCustomer(m.customerId);
    return (c?.name ?? "").trim().toLowerCase() === name;
  });
}

export function notifyPortalCustomerTicketEvent(input: {
  customerId?: string;
  customerName?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  ticketId: string;
  ticketNumber: string;
  printerId?: string | null;
  printerName?: string | null;
  priority?: "LOW" | "NORMAL" | "HIGH" | "CRITICAL";
  /** Extra staff recipients (dispatchers, etc.) */
  alsoNotify?: string[];
}) {
  const memberships = input.customerId
    ? membershipsForCustomerId(input.customerId)
    : membershipsForCustomerName(input.customerName ?? "");
  const userIds = [
    ...new Set([
      ...memberships.flatMap((m) => portalRecipientIds(m)),
      ...(input.alsoNotify ?? []),
    ]),
  ];
  if (userIds.length === 0) return null;
  return notifyTicketEvent({
    type: input.type,
    title: input.title,
    message: input.message,
    ticketId: input.ticketId,
    ticketNumber: input.ticketNumber,
    printerId: input.printerId,
    printerName: input.printerName,
    customerName: input.customerName,
    priority: input.priority,
    userIds,
  });
}
