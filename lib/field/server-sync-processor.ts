import { prisma } from "@/lib/db/prisma";
import type { WorkOrderStatus } from "@/lib/work-orders/types";
import { validateFieldStatusReceipt } from "./status-receipt-validation";

/**
 * Apply the safest first receipt type: a text note. Receipts without a real
 * server work order stay RECEIVED so an administrator can correct the data.
 */
export async function processReceivedFieldNotes(limit = 25) {
  const receipts = await prisma.offlineOperation.findMany({
    where: { status: "RECEIVED", type: "NOTE" }, orderBy: { createdAt: "asc" }, take: limit,
  });
  let applied = 0; let waiting = 0;
  for (const receipt of receipts) {
    const payload = JSON.parse(receipt.payload ?? "{}") as { note?: unknown; internal?: unknown };
    const note = typeof payload.note === "string" ? payload.note.trim() : "";
    if (!receipt.workOrderId || !note) {
      await prisma.offlineOperation.update({ where: { id: receipt.id }, data: { status: "REJECTED", lastError: "A note and server work order are required." } });
      continue;
    }
    const workOrder = await prisma.workOrder.findUnique({ where: { id: receipt.workOrderId }, select: { notes: true, internalNotes: true } });
    if (!workOrder) { waiting += 1; continue; }
    const field = payload.internal ? "internalNotes" : "notes";
    const previous = payload.internal ? workOrder.internalNotes : workOrder.notes;
    const updated = [previous, `[Field ${receipt.technicianName ?? "technician"}] ${note}`].filter(Boolean).join("\n");
    await prisma.$transaction([
      prisma.workOrder.update({ where: { id: receipt.workOrderId }, data: { [field]: updated } }),
      prisma.offlineOperation.update({ where: { id: receipt.id }, data: { status: "APPLIED", synchronizedAt: new Date(), lastError: null } }),
    ]);
    applied += 1;
  }
  return { scanned: receipts.length, applied, waiting };
}

export async function processReceivedFieldStatuses(limit = 25) {
  const receipts = await prisma.offlineOperation.findMany({
    where: { status: "RECEIVED", type: "STATUS_CHANGE" },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  let applied = 0;
  let waiting = 0;
  for (const receipt of receipts) {
    const payload = JSON.parse(receipt.payload ?? "{}") as { status?: unknown };
    if (!receipt.workOrderId) {
      await prisma.offlineOperation.update({
        where: { id: receipt.id },
        data: { status: "REJECTED", lastError: "A server work order is required." },
      });
      continue;
    }
    const workOrder = await prisma.workOrder.findUnique({
      where: { id: receipt.workOrderId },
      select: { status: true },
    });
    if (!workOrder) {
      waiting += 1;
      continue;
    }
    const check = validateFieldStatusReceipt(
      (workOrder.status ?? "NEW") as WorkOrderStatus,
      payload.status,
    );
    if (!check.ok) {
      await prisma.offlineOperation.update({
        where: { id: receipt.id },
        data: { status: "REJECTED", lastError: check.error },
      });
      continue;
    }
    await prisma.$transaction([
      prisma.workOrder.update({
        where: { id: receipt.workOrderId },
        data: {
          status: check.status,
          completedDate: check.status === "COMPLETED" ? new Date() : undefined,
        },
      }),
      prisma.offlineOperation.update({
        where: { id: receipt.id },
        data: { status: "APPLIED", synchronizedAt: new Date(), lastError: null },
      }),
    ]);
    applied += 1;
  }
  return { scanned: receipts.length, applied, waiting };
}

export async function processReceivedFieldParts(limit = 25) {
  const receipts = await prisma.offlineOperation.findMany({ where: { status: "RECEIVED", type: "PARTS_USAGE" }, orderBy: { createdAt: "asc" }, take: limit });
  let applied = 0; let waiting = 0;
  for (const receipt of receipts) {
    const payload = JSON.parse(receipt.payload ?? "{}") as { partNumber?: unknown; description?: unknown; quantityUsed?: unknown; unitCost?: unknown };
    const partNumber = typeof payload.partNumber === "string" ? payload.partNumber.trim() : "";
    const quantity = Number(payload.quantityUsed);
    if (!receipt.workOrderId || !partNumber || !Number.isFinite(quantity) || quantity <= 0) {
      await prisma.offlineOperation.update({ where: { id: receipt.id }, data: { status: "REJECTED", lastError: "A work order, part number, and positive quantity are required." } });
      continue;
    }
    const workOrder = await prisma.workOrder.findUnique({ where: { id: receipt.workOrderId }, select: { id: true } });
    if (!workOrder) { waiting += 1; continue; }
    await prisma.$transaction([
      prisma.workOrderPartLine.create({ data: { workOrderId: workOrder.id, partNumber, description: typeof payload.description === "string" ? payload.description : null, quantity: Math.floor(quantity), unitCost: Number.isFinite(Number(payload.unitCost)) ? Number(payload.unitCost) : null, source: "truck", addedBy: receipt.technicianName ?? "Field technician" } }),
      prisma.offlineOperation.update({ where: { id: receipt.id }, data: { status: "APPLIED", synchronizedAt: new Date(), lastError: null } }),
    ]);
    applied += 1;
  }
  return { scanned: receipts.length, applied, waiting };
}
