import { prisma } from "@/lib/db/prisma";

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
