import { prisma } from "@/lib/db/prisma";
import type { WorkOrder } from "./types";

export type ServerWorkOrderImportResult = {
  inserted: number;
  skipped: number;
  rejected: Array<{ workOrderNumber: string; reason: string }>;
};

function dateOrNull(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function importable(order: WorkOrder): string | null {
  if (!order.workOrderNumber?.trim()) return "Missing work-order number";
  if (!order.title?.trim()) return "Missing job title";
  return null;
}

/**
 * Copies prototype records into Prisma without altering browser records.
 * Existing server work-order numbers are always skipped, never updated.
 */
export async function copyWorkOrdersToServer(
  orders: WorkOrder[],
): Promise<ServerWorkOrderImportResult> {
  const result: ServerWorkOrderImportResult = { inserted: 0, skipped: 0, rejected: [] };
  const seen = new Set<string>();

  for (const order of orders) {
    const number = typeof order.workOrderNumber === "string" ? order.workOrderNumber.trim() : "";
    const problem = importable(order);
    if (problem) {
      result.rejected.push({ workOrderNumber: number || "Unknown", reason: problem });
      continue;
    }
    if (seen.has(number)) {
      result.rejected.push({ workOrderNumber: number, reason: "Duplicate in this copy request" });
      continue;
    }
    seen.add(number);

    const existing = await prisma.workOrder.findUnique({
      where: { workOrderNumber: number },
      select: { id: true },
    });
    if (existing) {
      result.skipped += 1;
      continue;
    }

    try {
      const printer = order.printerId
        ? await prisma.printer.findUnique({
            where: { id: order.printerId },
            select: { id: true },
          })
        : null;
      await prisma.workOrder.create({
        data: {
          workOrderNumber: number,
          legacyWorkOrderId: order.id,
          title: order.title.trim(),
          description: order.description || null,
          customerId: order.customerId || null,
          siteId: order.siteId || null,
          // Prototype printer IDs may not exist in Prisma yet; preserve the
          // browser record and import the work order without a broken relation.
          printerId: printer?.id ?? null,
          serviceType: order.serviceType || null,
          priority: order.priority || null,
          status: order.status || null,
          source: order.source || null,
          assignedTechnician: order.assignedTechnician || null,
          secondaryTechnician: order.secondaryTechnician || null,
          requestedBy: order.requestedBy || null,
          createdBy: order.createdBy || null,
          scheduledStart: dateOrNull(order.scheduledStart),
          scheduledEnd: dateOrNull(order.scheduledEnd),
          actualStart: dateOrNull(order.actualStart),
          actualEnd: dateOrNull(order.actualEnd),
          completedDate: dateOrNull(order.completedDate),
          estimatedHours: order.estimatedHours,
          actualHours: order.actualHours,
          travelTime: order.travelTime,
          mileage: order.mileage,
          laborRate: order.laborRate,
          laborCost: order.laborCost,
          notes: order.notes || null,
          internalNotes: order.internalNotes || null,
          customerVisibleNotes: order.customerVisibleNotes || null,
          customerSignature: order.customerSignature || null,
          copyCountAtStart: order.copyCountAtStart,
          copyCountAtEnd: order.copyCountAtEnd,
          partLines: order.parts.length
            ? { create: order.parts.map((part) => ({
                partNumber: part.partNumber,
                description: part.description || null,
                quantity: Math.max(1, Math.floor(part.quantity || 1)),
                unitCost: part.unitCost || null,
                source: part.source || null,
                addedBy: part.addedBy || null,
                addedAt: dateOrNull(part.addedAt) ?? new Date(),
              })) }
            : undefined,
          files: order.attachments.length
            ? { create: order.attachments.map((file) => ({
                kind: file.kind,
                fileName: file.fileName,
                mimeType: file.mimeType || null,
                sizeBytes: file.sizeBytes || null,
                uploadedBy: file.uploadedBy || null,
                storageRef: file.storageRef || null,
                notes: file.notes || null,
                uploadedAt: dateOrNull(file.uploadedAt) ?? new Date(),
              })) }
            : undefined,
        },
      });
      result.inserted += 1;
    } catch {
      result.rejected.push({ workOrderNumber: number, reason: "Could not create this server record" });
    }
  }

  return result;
}
