/**
 * Durable Field work-order read bridge.
 *
 * Matrix still uses the browser repository by default. Set
 * MATRIX_SERVER_FIELD_WORK_ORDERS=true only after server work orders have
 * been migrated and verified. Turning the flag off immediately returns every
 * Field API to the existing browser-backed repository.
 */
import { prisma } from "@/lib/db/prisma";
import { getWorkOrder, listWorkOrders } from "@/lib/work-orders/repository";
import type {
  WorkOrder,
  WorkOrderAttachmentKind,
  WorkOrderPriority,
  WorkOrderSource,
  WorkOrderStatus,
} from "@/lib/work-orders/types";

const STATUSES = new Set<WorkOrderStatus>([
  "DRAFT", "NEW", "ASSIGNED", "SCHEDULED", "TRAVELING", "ON_SITE",
  "WAITING_FOR_PARTS", "WAITING_FOR_CUSTOMER", "ON_HOLD", "COMPLETED",
  "CANCELLED", "CLOSED",
]);
const PRIORITIES = new Set<WorkOrderPriority>(["CRITICAL", "HIGH", "NORMAL", "LOW"]);
const SOURCES = new Set<WorkOrderSource>([
  "CUSTOMER_REQUEST", "DISPATCH", "MAINTENANCE_PLAN", "TECHNICIAN", "INTERNAL", "OTHER",
]);

function serverFlagEnabled(): boolean {
  return (process.env.MATRIX_SERVER_FIELD_WORK_ORDERS ?? "").trim().toLowerCase() === "true";
}

function asStatus(value: string | null): WorkOrderStatus {
  return STATUSES.has(value as WorkOrderStatus) ? (value as WorkOrderStatus) : "NEW";
}

function asPriority(value: string | null): WorkOrderPriority {
  return PRIORITIES.has(value as WorkOrderPriority) ? (value as WorkOrderPriority) : "NORMAL";
}

function asSource(value: string | null): WorkOrderSource {
  return SOURCES.has(value as WorkOrderSource) ? (value as WorkOrderSource) : "DISPATCH";
}

function asAttachmentKind(value: string | null): WorkOrderAttachmentKind {
  return value === "PHOTO" || value === "PDF" || value === "SERVICE_DOCUMENT" || value === "CONFIGURATION_FILE"
    ? value
    : "OTHER";
}

type ServerOrder = Awaited<ReturnType<typeof findServerOrder>>;

async function findServerOrder(idOrNumber: string) {
  return prisma.workOrder.findFirst({
    where: {
      OR: [
        { id: idOrNumber },
        { workOrderNumber: idOrNumber },
        { legacyWorkOrderId: idOrNumber },
      ],
    },
    include: { partLines: true, files: true },
  });
}

/** Converts the durable schema to the established Field package shape. */
export function mapServerWorkOrder(order: NonNullable<ServerOrder>): WorkOrder {
  return {
    id: order.id,
    workOrderNumber: order.workOrderNumber,
    title: order.title,
    description: order.description ?? "",
    customerId: order.customerId ?? "",
    customerName: order.customerId ? `Customer ${order.customerId}` : "Unassigned customer",
    siteId: order.siteId ?? "",
    siteName: order.siteId ? `Site ${order.siteId}` : "Unassigned site",
    siteAddress: "",
    region: "",
    printerId: order.printerId,
    printerName: null,
    printerModel: null,
    assetTag: null,
    serviceType: order.serviceType ?? "OTHER",
    priority: asPriority(order.priority),
    status: asStatus(order.status),
    source: asSource(order.source),
    assignedTechnician: order.assignedTechnician ?? "",
    secondaryTechnician: order.secondaryTechnician ?? "",
    requestedBy: order.requestedBy ?? "",
    createdBy: order.createdBy ?? "Matrix",
    scheduledStart: order.scheduledStart?.toISOString() ?? null,
    scheduledEnd: order.scheduledEnd?.toISOString() ?? null,
    actualStart: order.actualStart?.toISOString() ?? null,
    actualEnd: order.actualEnd?.toISOString() ?? null,
    completedDate: order.completedDate?.toISOString() ?? null,
    estimatedHours: order.estimatedHours,
    actualHours: order.actualHours,
    travelTime: order.travelTime,
    mileage: order.mileage,
    laborRate: order.laborRate,
    laborCost: order.laborCost,
    notes: order.notes ?? "",
    internalNotes: order.internalNotes ?? "",
    customerVisibleNotes: order.customerVisibleNotes ?? "",
    customerSignature: order.customerSignature,
    signatureCapturedAt: order.completedDate?.toISOString() ?? null,
    signatureCapturedBy: null,
    copyCountAtStart: order.copyCountAtStart,
    copyCountAtEnd: order.copyCountAtEnd,
    parts: order.partLines.map((part) => ({
      id: part.id, partNumber: part.partNumber, description: part.description ?? "",
      quantity: part.quantity, unitCost: part.unitCost ?? 0, source: part.source ?? "",
      addedBy: part.addedBy ?? "", addedAt: part.addedAt.toISOString(),
    })),
    attachments: order.files.map((file) => ({
      id: file.id, workOrderId: order.id, kind: asAttachmentKind(file.kind),
      fileName: file.fileName, mimeType: file.mimeType ?? "application/octet-stream",
      sizeBytes: file.sizeBytes ?? 0, uploadedBy: file.uploadedBy ?? "",
      uploadedAt: file.uploadedAt.toISOString(), notes: file.notes ?? "", storageRef: file.storageRef ?? "",
    })),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

export function isServerFieldWorkOrderBridgeEnabled(): boolean {
  return serverFlagEnabled();
}

export async function getFieldWorkOrder(idOrNumber: string): Promise<WorkOrder | undefined> {
  if (!serverFlagEnabled()) return getWorkOrder(idOrNumber);
  const order = await findServerOrder(idOrNumber);
  return order ? mapServerWorkOrder(order) : undefined;
}

export async function listFieldWorkOrders(): Promise<WorkOrder[]> {
  if (!serverFlagEnabled()) return listWorkOrders();
  const orders = await prisma.workOrder.findMany({
    include: { partLines: true, files: true },
    orderBy: { updatedAt: "desc" },
  });
  return orders.map(mapServerWorkOrder);
}
