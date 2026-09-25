/**
 * Read-only durable WorkOrder access for the office migration (step 1).
 * The office UI uses the browser repository by default; managers use the server queue only when the flag and rollout guard allow (Step 6).
 */
import { prisma } from "@/lib/db/prisma";
import { mapServerWorkOrder } from "@/lib/work-orders/server-field-repository";
import {
  mapServerAuditRow,
  mapServerTimelineRow,
} from "@/lib/work-orders/office-queue-client";
import type { WorkOrder, WorkOrderAuditEntry, WorkOrderTimelineEvent } from "@/lib/work-orders/types";

export const SERVER_OFFICE_WORK_ORDER_LIST_LIMIT = 500;

export const serverWorkOrderReadInclude = {
  partLines: true,
  files: true,
} as const;

/** Disabled by default; office UI ignores this until a later migration step. */
export function isServerOfficeWorkOrdersEnabled(): boolean {
  return (process.env.MATRIX_SERVER_OFFICE_WORK_ORDERS ?? "").trim().toLowerCase() === "true";
}

export async function listServerWorkOrdersForOffice(): Promise<WorkOrder[]> {
  const orders = await prisma.workOrder.findMany({
    include: serverWorkOrderReadInclude,
    orderBy: { updatedAt: "desc" },
    take: SERVER_OFFICE_WORK_ORDER_LIST_LIMIT,
  });
  return orders.map(mapServerWorkOrder);
}

export async function getServerWorkOrderForOffice(
  idOrNumber: string,
): Promise<WorkOrder | undefined> {
  const key = idOrNumber.trim();
  if (!key) return undefined;

  const order = await prisma.workOrder.findFirst({
    where: {
      OR: [{ id: key }, { workOrderNumber: key }, { legacyWorkOrderId: key }],
    },
    include: serverWorkOrderReadInclude,
  });
  return order ? mapServerWorkOrder(order) : undefined;
}

export async function getServerWorkOrderDetailForOffice(
  idOrNumber: string,
): Promise<
  | {
      workOrder: WorkOrder;
      timeline: WorkOrderTimelineEvent[];
      audit: WorkOrderAuditEntry[];
    }
  | undefined
> {
  const key = idOrNumber.trim();
  if (!key) return undefined;

  const order = await prisma.workOrder.findFirst({
    where: {
      OR: [{ id: key }, { workOrderNumber: key }, { legacyWorkOrderId: key }],
    },
    include: {
      ...serverWorkOrderReadInclude,
      timelineEvents: { orderBy: { occurredAt: "desc" }, take: 100 },
      auditEntries: { orderBy: { occurredAt: "desc" }, take: 100 },
    },
  });
  if (!order) return undefined;

  return {
    workOrder: mapServerWorkOrder(order),
    timeline: order.timelineEvents.map(mapServerTimelineRow),
    audit: order.auditEntries.map(mapServerAuditRow),
  };
}
