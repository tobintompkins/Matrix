/**
 * Patch 51B — Customer parts requests (existing inventory purchase workflow + portal table).
 */

import { prisma } from "@/lib/db/prisma";
import {
  createPurchaseRequest,
  updatePurchaseRequestStatus,
} from "@/lib/inventory/enterprise-repository";
import { writeAdminAudit } from "@/lib/admin/repository";
import { createEventNotification, pushNotification } from "@/lib/notifications";
import { portalRecipientIds } from "./notification-targets";
import type { CustomerMembership } from "./types";
import {
  assertPrinterAccess,
  setActivePortalMembership,
} from "./repository";
import { getPortalSettings } from "./config";
import { mapPartsStatusForPortal } from "./serializers";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";

async function nextPartsRequestNumber(customerId: string) {
  const year = new Date().getFullYear();
  const existing = await prisma.portalPartsRequest.findMany({
    where: {
      customerId,
      requestNumber: { startsWith: `CPR-${year}-` },
    },
    select: { requestNumber: true },
  });
  const max = existing.reduce((acc, row) => {
    const n = Number(row.requestNumber.split("-").pop());
    return Number.isFinite(n) ? Math.max(acc, n) : acc;
  }, 0);
  return `CPR-${year}-${String(max + 1).padStart(5, "0")}`;
}

export async function createPortalPartsRequest(input: {
  membership: CustomerMembership;
  machineId?: string | null;
  locationId?: string | null;
  requestType: string;
  description: string;
  quantity: number;
  businessReason?: string | null;
  urgency?: string;
  serviceRequestId?: string | null;
  shippingContact?: string | null;
  shippingAddress?: string | null;
  organizationId?: string;
}) {
  setActivePortalMembership(input.membership.id);
  const settings = await getPortalSettings(
    input.organizationId ?? DEFAULT_ORG_ID,
  );
  if (!settings.allowCustomerPartsRequests) {
    return { ok: false as const, error: "Parts requests are disabled." };
  }
  if (!input.description.trim()) {
    return { ok: false as const, error: "Description is required." };
  }
  if (input.quantity < 1) {
    return { ok: false as const, error: "Quantity must be at least 1." };
  }
  if (input.machineId) {
    const access = assertPrinterAccess(input.machineId);
    if (!access.ok) return { ok: false as const, error: access.error };
  }

  const purchase = createPurchaseRequest({
    requester: input.membership.displayName,
    priority:
      input.urgency === "CRITICAL" || input.urgency === "HIGH"
        ? "HIGH"
        : "NORMAL",
    vendorId: null,
    justification: [
      `Portal parts request (${input.requestType})`,
      input.businessReason ?? "",
      input.description,
    ]
      .filter(Boolean)
      .join(" — "),
    lines: [
      {
        partId: "portal-customer-request",
        partNumber: "CUSTOMER-REQUEST",
        description: input.description.slice(0, 200),
        quantity: input.quantity,
        unitCost: 0,
      },
    ],
  });

  if (!purchase.ok || !purchase.request) {
    return {
      ok: false as const,
      error: purchase.error ?? "Unable to create parts request.",
    };
  }

  updatePurchaseRequestStatus(purchase.request.id, "PENDING_APPROVAL");

  const requestNumber = await nextPartsRequestNumber(
    input.membership.customerId,
  );

  const row = await prisma.portalPartsRequest.create({
    data: {
      customerId: input.membership.customerId,
      membershipId: input.membership.id,
      requestNumber,
      machineId: input.machineId ?? null,
      locationId: input.locationId ?? null,
      requestType: input.requestType,
      description: input.description.trim(),
      quantity: input.quantity,
      businessReason: input.businessReason ?? null,
      urgency: input.urgency ?? "NORMAL",
      serviceRequestId: input.serviceRequestId ?? null,
      shippingContact: input.shippingContact ?? null,
      shippingAddress: input.shippingAddress ?? null,
      status: "SUBMITTED",
      purchaseRequestId: purchase.request.id,
      approvalRequestId: null,
    },
  });

  await writeAdminAudit({
    organizationId: input.organizationId ?? DEFAULT_ORG_ID,
    actorId: input.membership.clerkUserId,
    action: "PORTAL_PARTS_REQUEST_CREATED",
    entityType: "PortalPartsRequest",
    entityId: row.id,
    payload: {
      requestNumber,
      purchaseRequestId: purchase.request.id,
      customerId: input.membership.customerId,
    },
  });

  pushNotification(
    createEventNotification({
      type: "PARTS_REQUESTED",
      title: `Portal parts request — ${requestNumber}`,
      message: `${input.membership.displayName}: ${input.description.slice(0, 120)}`,
      userIds: ["Matrix User", ...portalRecipientIds(input.membership)],
      priority: input.urgency === "CRITICAL" ? "HIGH" : "NORMAL",
      relatedRecordType: "portal_parts_request",
      relatedRecordId: row.id,
    }),
  );

  return {
    ok: true as const,
    item: serializePartsRequest(row),
  };
}

function serializePartsRequest(row: {
  id: string;
  requestNumber: string;
  requestType: string;
  description: string;
  quantity: number;
  urgency: string;
  status: string;
  machineId: string | null;
  locationId: string | null;
  createdAt: Date;
  updatedAt: Date;
  purchaseRequestId: string | null;
}) {
  return {
    id: row.id,
    requestNumber: row.requestNumber,
    requestType: row.requestType,
    description: row.description,
    quantity: row.quantity,
    urgency: row.urgency,
    status: mapPartsStatusForPortal(row.status),
    machineId: row.machineId,
    locationId: row.locationId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listPortalPartsRequests(membership: CustomerMembership) {
  const rows = await prisma.portalPartsRequest.findMany({
    where: { customerId: membership.customerId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return rows.map(serializePartsRequest);
}

export async function getPortalPartsRequest(
  membership: CustomerMembership,
  id: string,
) {
  const row = await prisma.portalPartsRequest.findFirst({
    where: { id, customerId: membership.customerId },
  });
  if (!row) return null;
  return serializePartsRequest(row);
}
