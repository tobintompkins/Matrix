import { prisma } from "@/lib/db/prisma";
import type { WorkOrderStatus } from "@/lib/work-orders/types";
import { validateAttachmentReceipt } from "./attachment-receipt-validation";
import { buildProtectedAttachmentStorageRef } from "./attachment-storage-guard";
import { validateCompletionReceipt } from "./completion-receipt-guard";
import { validatePhotoReceipt } from "./photo-receipt-validation";
import { buildProtectedPhotoStorageRef } from "./photo-storage-guard";
import { validateFieldStatusReceipt } from "./status-receipt-validation";
import { validateFieldSignatureReceipt } from "./signature-receipt-validation";
import { validateFieldCopyCountReceipt } from "./copy-count-receipt-validation";
import { validateFieldMaintenanceReceipt } from "./maintenance-receipt-validation";

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

export async function processReceivedFieldCompletions(limit = 25) {
  const receipts = await prisma.offlineOperation.findMany({
    where: { status: "RECEIVED", type: "COMPLETION" },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  let applied = 0;
  let waiting = 0;
  for (const receipt of receipts) {
    const payload = JSON.parse(receipt.payload ?? "{}") as Record<string, unknown>;
    const check = validateCompletionReceipt(payload);
    if (!check.ok || !receipt.workOrderId) {
      await prisma.offlineOperation.update({
        where: { id: receipt.id },
        data: {
          status: "REJECTED",
          lastError: check.ok ? "A server work order is required." : check.error,
        },
      });
      continue;
    }
    const workOrder = await prisma.workOrder.findUnique({
      where: { id: receipt.workOrderId },
      select: { id: true, status: true },
    });
    if (!workOrder) {
      waiting += 1;
      continue;
    }
    if (workOrder.status !== "ON_SITE") {
      await prisma.offlineOperation.update({
        where: { id: receipt.id },
        data: { status: "REJECTED", lastError: "Only on-site work orders can be completed." },
      });
      continue;
    }
    await prisma.$transaction([
      prisma.workOrder.update({
        where: { id: workOrder.id },
        data: { status: "COMPLETED", completedDate: new Date(), notes: check.resolution },
      }),
      prisma.offlineOperation.update({
        where: { id: receipt.id },
        data: { status: "APPLIED", synchronizedAt: new Date() },
      }),
    ]);
    applied += 1;
  }
  return { scanned: receipts.length, applied, waiting };
}

export async function processReceivedFieldPhotos(limit = 25) {
  const receipts = await prisma.offlineOperation.findMany({
    where: { status: "RECEIVED", type: "PHOTO" },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  let applied = 0;
  let waiting = 0;
  for (const receipt of receipts) {
    const payload = JSON.parse(receipt.payload ?? "{}") as Record<string, unknown>;
    const check = validatePhotoReceipt(payload);
    if (!check.ok || !receipt.workOrderId) {
      await prisma.offlineOperation.update({
        where: { id: receipt.id },
        data: {
          status: "REJECTED",
          lastError: check.ok ? "A server work order is required." : check.error,
        },
      });
      continue;
    }
    const order = await prisma.workOrder.findUnique({
      where: { id: receipt.workOrderId },
      select: { id: true },
    });
    if (!order) {
      waiting += 1;
      continue;
    }
    await prisma.$transaction([
      prisma.workOrderFile.create({
        data: {
          workOrderId: order.id,
          kind: "PHOTO",
          fileName: check.fileName,
          mimeType: check.mimeType,
          sizeBytes: check.sizeBytes,
          uploadedBy: receipt.technicianName ?? "Field technician",
          storageRef: buildProtectedPhotoStorageRef({
            operationId: receipt.operationId,
            fileName: check.fileName,
          }),
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

export async function processReceivedFieldAttachments(limit = 25) {
  const receipts = await prisma.offlineOperation.findMany({
    where: { status: "RECEIVED", type: "ATTACHMENT" },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  let applied = 0;
  let waiting = 0;
  for (const receipt of receipts) {
    const payload = JSON.parse(receipt.payload ?? "{}") as Record<string, unknown>;
    const check = validateAttachmentReceipt(payload);
    if (!check.ok || !receipt.workOrderId) {
      await prisma.offlineOperation.update({
        where: { id: receipt.id },
        data: {
          status: "REJECTED",
          lastError: check.ok ? "A server work order is required." : check.error,
        },
      });
      continue;
    }
    const order = await prisma.workOrder.findUnique({
      where: { id: receipt.workOrderId },
      select: { id: true },
    });
    if (!order) {
      waiting += 1;
      continue;
    }
    await prisma.$transaction([
      prisma.workOrderFile.create({
        data: {
          workOrderId: order.id,
          kind: "ATTACHMENT",
          fileName: check.fileName,
          mimeType: check.mimeType,
          sizeBytes: check.sizeBytes,
          uploadedBy: receipt.technicianName ?? "Field technician",
          storageRef: buildProtectedAttachmentStorageRef({
            operationId: receipt.operationId,
            fileName: check.fileName,
          }),
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

/** Apply customer-signature evidence without storing the browser's transient canvas data. */
export async function processReceivedFieldSignatures(limit = 25) {
  const receipts = await prisma.offlineOperation.findMany({
    where: { status: "RECEIVED", type: "SIGNATURE" }, orderBy: { createdAt: "asc" }, take: limit,
  });
  let applied = 0;
  let waiting = 0;
  for (const receipt of receipts) {
    const payload = JSON.parse(receipt.payload ?? "{}") as Record<string, unknown>;
    const check = validateFieldSignatureReceipt(payload);
    if (!check.ok || !receipt.workOrderId) {
      await prisma.offlineOperation.update({
        where: { id: receipt.id },
        data: { status: "REJECTED", lastError: check.ok ? "A server work order is required." : check.error },
      });
      continue;
    }
    const workOrder = await prisma.workOrder.findUnique({
      where: { id: receipt.workOrderId },
      select: { id: true, customerSignature: true, internalNotes: true },
    });
    if (!workOrder) {
      waiting += 1;
      continue;
    }

    const actor = receipt.technicianName ?? "Field technician";
    const occurredAt = new Date();
    const previousValue = workOrder.customerSignature;
    const nextSignature = check.kind === "captured" ? check.signerName : workOrder.customerSignature;
    const nextInternalNotes = check.kind === "captured"
      ? workOrder.internalNotes
      : [workOrder.internalNotes, `[Field ${actor}] Signature declined: ${check.declineReason}`].filter(Boolean).join("\n");
    const title = check.kind === "captured" ? "Customer Signature Captured" : "Customer Signature Declined";
    const detail = check.kind === "captured" ? check.signerName : check.declineReason;

    await prisma.$transaction([
      prisma.workOrder.update({
        where: { id: workOrder.id },
        data: { customerSignature: nextSignature, internalNotes: nextInternalNotes },
      }),
      prisma.workOrderTimelineEvent.create({
        data: { workOrderId: workOrder.id, type: "SIGNATURE", title, description: detail, actor, previousValue, newValue: nextSignature, occurredAt },
      }),
      prisma.workOrderAuditEntry.create({
        data: { workOrderId: workOrder.id, field: "customerSignature", previousValue, newValue: nextSignature, actor, action: check.kind === "captured" ? "CAPTURED" : "DECLINED", occurredAt },
      }),
      prisma.offlineOperation.update({
        where: { id: receipt.id },
        data: { status: "APPLIED", synchronizedAt: occurredAt, lastError: null },
      }),
    ]);
    applied += 1;
  }
  return { scanned: receipts.length, applied, waiting };
}

/** Persist Field meter readings and their immutable count history on the server. */
export async function processReceivedFieldCopyCounts(limit = 25) {
  const receipts = await prisma.offlineOperation.findMany({
    where: { status: "RECEIVED", type: "COPY_COUNT" }, orderBy: { createdAt: "asc" }, take: limit,
  });
  let applied = 0;
  let waiting = 0;
  for (const receipt of receipts) {
    const payload = JSON.parse(receipt.payload ?? "{}") as Record<string, unknown>;
    const check = validateFieldCopyCountReceipt(payload);
    if (!check.ok || !receipt.printerId) {
      await prisma.offlineOperation.update({
        where: { id: receipt.id },
        data: { status: "REJECTED", lastError: check.ok ? "A server printer is required." : check.error },
      });
      continue;
    }
    const printer = await prisma.printer.findUnique({
      where: { id: receipt.printerId }, select: { id: true, currentCopyCount: true },
    });
    if (!printer) { waiting += 1; continue; }
    if (printer.currentCopyCount != null && check.copyCount < printer.currentCopyCount && !check.lowerCountReason) {
      await prisma.offlineOperation.update({
        where: { id: receipt.id }, data: { status: "REJECTED", lastError: "A reason is required when a copy count is lower than the current server count." },
      });
      continue;
    }
    const workOrder = receipt.workOrderId
      ? await prisma.workOrder.findUnique({ where: { id: receipt.workOrderId }, select: { id: true, copyCountAtEnd: true } })
      : null;
    if (receipt.workOrderId && !workOrder) { waiting += 1; continue; }
    const occurredAt = new Date();
    await prisma.$transaction([
      prisma.printer.update({ where: { id: printer.id }, data: { previousCopyCount: printer.currentCopyCount, currentCopyCount: check.copyCount } }),
      prisma.copyCountHistory.create({ data: { printerId: printer.id, recordedAt: occurredAt, copyCount: check.copyCount, enteredBy: receipt.technicianName, notes: check.note || null, previousCount: printer.currentCopyCount, lowerCountReason: check.lowerCountReason || null } }),
      prisma.offlineOperation.update({ where: { id: receipt.id }, data: { status: "APPLIED", synchronizedAt: occurredAt, lastError: null } }),
      ...(workOrder ? [
        prisma.workOrder.update({ where: { id: workOrder.id }, data: { copyCountAtEnd: check.copyCount } }),
        prisma.workOrderTimelineEvent.create({ data: { workOrderId: workOrder.id, type: "COPY_COUNT", title: "Copy Count Recorded", description: check.note || null, actor: receipt.technicianName, previousValue: workOrder.copyCountAtEnd?.toString() ?? null, newValue: check.copyCount.toString(), occurredAt } }),
        prisma.workOrderAuditEntry.create({ data: { workOrderId: workOrder.id, field: "copyCountAtEnd", previousValue: workOrder.copyCountAtEnd?.toString() ?? null, newValue: check.copyCount.toString(), actor: receipt.technicianName, action: "FIELD_COPY_COUNT", occurredAt } }),
      ] : []),
    ]);
    applied += 1;
  }
  return { scanned: receipts.length, applied, waiting };
}

/** Persist a validated Field maintenance completion and reset the matching baseline. */
export async function processReceivedFieldMaintenanceCompletions(limit = 25) {
  const receipts = await prisma.offlineOperation.findMany({ where: { status: "RECEIVED", type: "MAINTENANCE_COMPLETION" }, orderBy: { createdAt: "asc" }, take: limit });
  let applied = 0; let waiting = 0;
  for (const receipt of receipts) {
    const check = validateFieldMaintenanceReceipt(JSON.parse(receipt.payload ?? "{}") as Record<string, unknown>);
    if (!check.ok || !receipt.printerId) { await prisma.offlineOperation.update({ where: { id: receipt.id }, data: { status: "REJECTED", lastError: check.ok ? "A server printer is required." : check.error } }); continue; }
    const printer = await prisma.printer.findUnique({ where: { id: receipt.printerId }, select: { id: true, printerModel: { select: { pmIntervalCopies: true, cleaningIntervalCopies: true, jointUnitIntervalCopies: true, dtfPmIntervalCopies: true } } } });
    if (!printer) { waiting += 1; continue; }
    const interval = check.kind === "PM" ? printer.printerModel.pmIntervalCopies : check.kind === "CLEANING" ? printer.printerModel.cleaningIntervalCopies : check.kind === "JOINT_UNIT" ? printer.printerModel.jointUnitIntervalCopies : printer.printerModel.dtfPmIntervalCopies;
    const now = new Date(); const due = interval == null ? null : check.copyCount + interval;
    const baseline = check.kind === "PM" ? { lastPMCopyCount: check.copyCount, lastPMDate: now, nextPMDueCount: due } : check.kind === "CLEANING" ? { lastCleaningCopyCount: check.copyCount, lastCleaningDate: now, nextCleaningDueCount: due } : check.kind === "JOINT_UNIT" ? { lastJointUnitCopyCount: check.copyCount, lastJointUnitDate: now, nextJointUnitDueCount: due } : { lastDTFPMCopyCount: check.copyCount, lastDTFPMDate: now, nextDTFDueCount: due };
    await prisma.$transaction([
      prisma.printer.update({ where: { id: printer.id }, data: { currentCopyCount: check.copyCount, ...baseline } }),
      prisma.maintenanceCompletion.create({ data: { printerId: printer.id, kind: check.kind, completedAt: now, copyCountAtCompletion: check.copyCount, technician: receipt.technicianName, notes: check.notes || null, workPerformed: check.workPerformed || null, previousCount: null, intervalAtCompletion: interval ?? null, recordedBy: receipt.technicianName, idempotencyKey: receipt.operationId } }),
      prisma.offlineOperation.update({ where: { id: receipt.id }, data: { status: "APPLIED", synchronizedAt: now, lastError: null } }),
    ]); applied += 1;
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
