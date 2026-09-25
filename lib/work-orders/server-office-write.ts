/**
 * Durable WorkOrder writes for office migration (step 2).
 * Browser UI remains default until MATRIX_SERVER_OFFICE_WORK_ORDERS is enabled.
 */
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import { getServerWorkOrderForOffice } from "@/lib/work-orders/server-office-read";
import {
  laborCostFrom,
  nextWorkOrderNumber,
  validateCreateWorkOrderInput,
} from "@/lib/work-orders/helpers";
import { assertWorkOrderTransition } from "@/lib/work-orders/workflow";
import type {
  CreateWorkOrderInput,
  WorkOrder,
  WorkOrderAttachmentKind,
  WorkOrderStatus,
} from "@/lib/work-orders/types";

export type ServerWriteResult =
  | { ok: true; workOrder: WorkOrder }
  | { ok: false; error: string; status: 400 | 404 | 409 };

type TimelineSpec = {
  type: string;
  title: string;
  description?: string;
  previousValue?: string | null;
  newValue?: string | null;
};

type AuditSpec = {
  field: string;
  previousValue: string | null;
  newValue: string | null;
  action: string;
};

export function resolveInitialServerWorkOrderStatus(
  input: Pick<CreateWorkOrderInput, "asDraft" | "assignedTechnician">,
): WorkOrderStatus {
  if (input.asDraft) return "DRAFT";
  if (input.assignedTechnician?.trim()) return "ASSIGNED";
  return "NEW";
}

export function parseOfficeDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatOfficeDate(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString();
}

function stringOrNull(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  return typeof value === "string" ? value : null;
}

function numberOrNull(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

async function resolveWorkOrderRow(key: string) {
  const trimmed = key.trim();
  if (!trimmed) return null;
  return prisma.workOrder.findFirst({
    where: {
      OR: [{ id: trimmed }, { workOrderNumber: trimmed }, { legacyWorkOrderId: trimmed }],
    },
  });
}

async function reloadWorkOrder(id: string): Promise<WorkOrder | undefined> {
  return getServerWorkOrderForOffice(id);
}

async function applyMutation(
  workOrderId: string,
  actor: string,
  data: Prisma.WorkOrderUpdateInput,
  timeline: TimelineSpec,
  audits: AuditSpec[],
): Promise<ServerWriteResult> {
  await prisma.$transaction([
    prisma.workOrder.update({ where: { id: workOrderId }, data }),
    prisma.workOrderTimelineEvent.create({
      data: {
        workOrderId,
        type: timeline.type,
        title: timeline.title,
        description: timeline.description ?? null,
        actor,
        previousValue: timeline.previousValue ?? null,
        newValue: timeline.newValue ?? null,
      },
    }),
    ...audits.map((audit) =>
      prisma.workOrderAuditEntry.create({
        data: {
          workOrderId,
          field: audit.field,
          previousValue: audit.previousValue,
          newValue: audit.newValue,
          actor,
          action: audit.action,
        },
      }),
    ),
  ]);

  const workOrder = await reloadWorkOrder(workOrderId);
  if (!workOrder) {
    return { ok: false, error: "Work order not found after update.", status: 404 };
  }
  return { ok: true, workOrder };
}

async function resolvePrinterId(printerId: string | null | undefined): Promise<string | null> {
  if (!printerId?.trim()) return null;
  const printer = await prisma.printer.findUnique({
    where: { id: printerId.trim() },
    select: { id: true },
  });
  return printer?.id ?? null;
}

export async function createServerWorkOrderForOffice(
  input: CreateWorkOrderInput,
  actor: string,
): Promise<ServerWriteResult> {
  const validation = validateCreateWorkOrderInput(input);
  if (!validation.ok) return { ok: false, error: validation.error, status: 400 };

  const existingNumbers = await prisma.workOrder.findMany({
    select: { workOrderNumber: true },
  });
  const workOrderNumber = nextWorkOrderNumber(existingNumbers.map((row) => row.workOrderNumber));
  const status = resolveInitialServerWorkOrderStatus(input);
  const printerId = await resolvePrinterId(input.printerId);

  const created = await prisma.$transaction(async (tx) => {
    const order = await tx.workOrder.create({
      data: {
        workOrderNumber,
        title: input.title.trim(),
        description: input.description.trim() || null,
        customerId: input.customerId?.trim() || null,
        siteId: input.siteId?.trim() || null,
        printerId,
        serviceType: String(input.serviceType),
        priority: input.priority,
        status,
        source: input.source ?? "DISPATCH",
        assignedTechnician: input.assignedTechnician?.trim() || null,
        secondaryTechnician: input.secondaryTechnician?.trim() || null,
        requestedBy: input.requestedBy?.trim() || input.createdBy,
        createdBy: input.createdBy.trim() || actor,
        scheduledStart: parseOfficeDate(input.scheduledStart ?? null) ?? null,
        scheduledEnd: parseOfficeDate(input.scheduledEnd ?? null) ?? null,
        estimatedHours: input.estimatedHours ?? null,
        notes: input.notes?.trim() || null,
        internalNotes: input.internalNotes?.trim() || null,
        customerVisibleNotes: input.customerVisibleNotes?.trim() || null,
      },
    });

    await tx.workOrderTimelineEvent.create({
      data: {
        workOrderId: order.id,
        type: "CREATED",
        title: "Work order created on server",
        description: `${workOrderNumber} created for ${input.customerName.trim()} / ${input.siteName.trim()}.`,
        actor,
        newValue: status,
      },
    });

    await tx.workOrderAuditEntry.create({
      data: {
        workOrderId: order.id,
        field: "workOrderNumber",
        previousValue: null,
        newValue: workOrderNumber,
        actor,
        action: "CREATED_ON_SERVER",
      },
    });

    if (input.assignedTechnician?.trim()) {
      await tx.workOrderTimelineEvent.create({
        data: {
          workOrderId: order.id,
          type: "ASSIGNED",
          title: "Technician assigned",
          actor,
          newValue: input.assignedTechnician.trim(),
        },
      });
    }

    return order;
  });

  const workOrder = await reloadWorkOrder(created.id);
  if (!workOrder) {
    return { ok: false, error: "Work order not found after create.", status: 404 };
  }
  return { ok: true, workOrder };
}

export async function updateServerWorkOrderAssignmentForOffice(
  key: string,
  body: { assignedTechnician?: unknown; secondaryTechnician?: unknown },
  actor: string,
): Promise<ServerWriteResult> {
  const order = await resolveWorkOrderRow(key);
  if (!order) return { ok: false, error: "Work order not found.", status: 404 };

  const assigned =
    body.assignedTechnician === undefined
      ? order.assignedTechnician
      : stringOrNull(body.assignedTechnician)?.trim() || null;
  const secondary =
    body.secondaryTechnician === undefined
      ? order.secondaryTechnician
      : stringOrNull(body.secondaryTechnician)?.trim() || null;

  const audits: AuditSpec[] = [];
  if (assigned !== order.assignedTechnician) {
    audits.push({
      field: "assignedTechnician",
      previousValue: order.assignedTechnician,
      newValue: assigned,
      action: "ASSIGNMENT_UPDATED",
    });
  }
  if (secondary !== order.secondaryTechnician) {
    audits.push({
      field: "secondaryTechnician",
      previousValue: order.secondaryTechnician,
      newValue: secondary,
      action: "ASSIGNMENT_UPDATED",
    });
  }
  if (audits.length === 0) {
    return { ok: false, error: "No assignment changes provided.", status: 400 };
  }

  return applyMutation(
    order.id,
    actor,
    { assignedTechnician: assigned, secondaryTechnician: secondary },
    {
      type: "ASSIGNED",
      title: "Assignment updated",
      description: "Office server assignment updated.",
      previousValue: order.assignedTechnician,
      newValue: assigned,
    },
    audits,
  );
}

export async function updateServerWorkOrderScheduleForOffice(
  key: string,
  body: { scheduledStart?: unknown; scheduledEnd?: unknown },
  actor: string,
): Promise<ServerWriteResult> {
  const order = await resolveWorkOrderRow(key);
  if (!order) return { ok: false, error: "Work order not found.", status: 404 };

  const scheduledStart =
    body.scheduledStart === undefined
      ? order.scheduledStart
      : parseOfficeDate(body.scheduledStart);
  const scheduledEnd =
    body.scheduledEnd === undefined ? order.scheduledEnd : parseOfficeDate(body.scheduledEnd);

  if (scheduledStart === null || scheduledEnd === null) {
    return { ok: false, error: "Invalid schedule date.", status: 400 };
  }
  if (
    scheduledStart === order.scheduledStart &&
    scheduledEnd === order.scheduledEnd
  ) {
    return { ok: false, error: "No schedule changes provided.", status: 400 };
  }

  const audits: AuditSpec[] = [];
  if (scheduledStart !== order.scheduledStart) {
    audits.push({
      field: "scheduledStart",
      previousValue: formatOfficeDate(order.scheduledStart),
      newValue: formatOfficeDate(scheduledStart ?? null),
      action: "SCHEDULE_UPDATED",
    });
  }
  if (scheduledEnd !== order.scheduledEnd) {
    audits.push({
      field: "scheduledEnd",
      previousValue: formatOfficeDate(order.scheduledEnd),
      newValue: formatOfficeDate(scheduledEnd ?? null),
      action: "SCHEDULE_UPDATED",
    });
  }

  return applyMutation(
    order.id,
    actor,
    { scheduledStart: scheduledStart ?? null, scheduledEnd: scheduledEnd ?? null },
    {
      type: "FIELD_CHANGED",
      title: "Schedule updated",
      description: "Office server schedule updated.",
      previousValue: formatOfficeDate(order.scheduledStart),
      newValue: formatOfficeDate(scheduledStart ?? null),
    },
    audits,
  );
}

export async function updateServerWorkOrderStatusForOffice(
  key: string,
  body: { status?: unknown },
  actor: string,
): Promise<ServerWriteResult> {
  const order = await resolveWorkOrderRow(key);
  if (!order) return { ok: false, error: "Work order not found.", status: 404 };

  const nextStatus = stringOrNull(body.status)?.trim();
  if (!nextStatus) return { ok: false, error: "Status is required.", status: 400 };

  const from = (order.status ?? "NEW") as WorkOrderStatus;
  const to = nextStatus as WorkOrderStatus;
  const transition = assertWorkOrderTransition(from, to);
  if (!transition.ok) return { ok: false, error: transition.message, status: 409 };

  const completedDate =
    to === "COMPLETED" || to === "CLOSED" ? order.completedDate ?? new Date() : order.completedDate;

  return applyMutation(
    order.id,
    actor,
    { status: to, completedDate },
    {
      type: "STATUS_CHANGED",
      title: "Status updated",
      previousValue: from,
      newValue: to,
    },
    [
      {
        field: "status",
        previousValue: from,
        newValue: to,
        action: "STATUS_UPDATED",
      },
    ],
  );
}

export async function updateServerWorkOrderNotesForOffice(
  key: string,
  body: { notes?: unknown; internalNotes?: unknown; customerVisibleNotes?: unknown },
  actor: string,
): Promise<ServerWriteResult> {
  const order = await resolveWorkOrderRow(key);
  if (!order) return { ok: false, error: "Work order not found.", status: 404 };

  const notes = body.notes === undefined ? order.notes : stringOrNull(body.notes);
  const internalNotes =
    body.internalNotes === undefined ? order.internalNotes : stringOrNull(body.internalNotes);
  const customerVisibleNotes =
    body.customerVisibleNotes === undefined
      ? order.customerVisibleNotes
      : stringOrNull(body.customerVisibleNotes);

  if (
    notes === order.notes &&
    internalNotes === order.internalNotes &&
    customerVisibleNotes === order.customerVisibleNotes
  ) {
    return { ok: false, error: "No note changes provided.", status: 400 };
  }

  const audits: AuditSpec[] = [];
  if (notes !== order.notes) {
    audits.push({
      field: "notes",
      previousValue: order.notes,
      newValue: notes,
      action: "NOTES_UPDATED",
    });
  }
  if (internalNotes !== order.internalNotes) {
    audits.push({
      field: "internalNotes",
      previousValue: order.internalNotes,
      newValue: internalNotes,
      action: "NOTES_UPDATED",
    });
  }
  if (customerVisibleNotes !== order.customerVisibleNotes) {
    audits.push({
      field: "customerVisibleNotes",
      previousValue: order.customerVisibleNotes,
      newValue: customerVisibleNotes,
      action: "NOTES_UPDATED",
    });
  }

  return applyMutation(
    order.id,
    actor,
    { notes, internalNotes, customerVisibleNotes },
    {
      type: "NOTE_ADDED",
      title: "Notes updated",
      description: "Office server notes updated.",
    },
    audits,
  );
}

export async function addServerWorkOrderPartForOffice(
  key: string,
  body: {
    partNumber?: unknown;
    description?: unknown;
    quantity?: unknown;
    unitCost?: unknown;
    source?: unknown;
  },
  actor: string,
): Promise<ServerWriteResult> {
  const order = await resolveWorkOrderRow(key);
  if (!order) return { ok: false, error: "Work order not found.", status: 404 };

  const partNumber = stringOrNull(body.partNumber)?.trim();
  if (!partNumber) return { ok: false, error: "Part number is required.", status: 400 };

  const quantityRaw = numberOrNull(body.quantity);
  const quantity = Math.max(1, Math.floor(quantityRaw ?? 1));

  await prisma.$transaction([
    prisma.workOrderPartLine.create({
      data: {
        workOrderId: order.id,
        partNumber,
        description: stringOrNull(body.description),
        quantity,
        unitCost: numberOrNull(body.unitCost) ?? null,
        source: stringOrNull(body.source),
        addedBy: actor,
      },
    }),
    prisma.workOrderTimelineEvent.create({
      data: {
        workOrderId: order.id,
        type: "PART_ADDED",
        title: "Part line added",
        description: `${partNumber} × ${quantity}`,
        actor,
        newValue: partNumber,
      },
    }),
    prisma.workOrderAuditEntry.create({
      data: {
        workOrderId: order.id,
        field: "partLines",
        previousValue: null,
        newValue: partNumber,
        actor,
        action: "PART_ADDED",
      },
    }),
    prisma.workOrder.update({ where: { id: order.id }, data: { updatedAt: new Date() } }),
  ]);

  const workOrder = await reloadWorkOrder(order.id);
  if (!workOrder) return { ok: false, error: "Work order not found after part add.", status: 404 };
  return { ok: true, workOrder };
}

export async function updateServerWorkOrderLaborForOffice(
  key: string,
  body: {
    estimatedHours?: unknown;
    actualHours?: unknown;
    travelTime?: unknown;
    mileage?: unknown;
    laborRate?: unknown;
    laborCost?: unknown;
  },
  actor: string,
): Promise<ServerWriteResult> {
  const order = await resolveWorkOrderRow(key);
  if (!order) return { ok: false, error: "Work order not found.", status: 404 };

  const estimatedHours = numberOrNull(body.estimatedHours);
  const actualHours = numberOrNull(body.actualHours);
  const travelTime = numberOrNull(body.travelTime);
  const mileage = numberOrNull(body.mileage);
  const laborRate = numberOrNull(body.laborRate);
  let laborCost = numberOrNull(body.laborCost);

  const nextEstimated = estimatedHours === undefined ? order.estimatedHours : estimatedHours;
  const nextActual = actualHours === undefined ? order.actualHours : actualHours;
  const nextTravel = travelTime === undefined ? order.travelTime : travelTime;
  const nextMileage = mileage === undefined ? order.mileage : mileage;
  const nextRate = laborRate === undefined ? order.laborRate : laborRate;

  if (laborCost === undefined) {
    laborCost = laborCostFrom(nextActual, nextRate);
  }

  const data = {
    estimatedHours: nextEstimated,
    actualHours: nextActual,
    travelTime: nextTravel,
    mileage: nextMileage,
    laborRate: nextRate,
    laborCost,
  };

  const changed =
    nextEstimated !== order.estimatedHours ||
    nextActual !== order.actualHours ||
    nextTravel !== order.travelTime ||
    nextMileage !== order.mileage ||
    nextRate !== order.laborRate ||
    laborCost !== order.laborCost;

  if (!changed) {
    return { ok: false, error: "No labor changes provided.", status: 400 };
  }

  return applyMutation(
    order.id,
    actor,
    data,
    {
      type: "LABOR_UPDATED",
      title: "Labor updated",
      description: "Office server labor fields updated.",
      newValue:
        nextActual != null ? String(nextActual) : nextEstimated != null ? String(nextEstimated) : null,
    },
    [
      {
        field: "labor",
        previousValue: order.actualHours != null ? String(order.actualHours) : null,
        newValue: nextActual != null ? String(nextActual) : null,
        action: "LABOR_UPDATED",
      },
    ],
  );
}

const ATTACHMENT_KINDS = new Set<WorkOrderAttachmentKind>([
  "PHOTO",
  "PDF",
  "SERVICE_DOCUMENT",
  "CONFIGURATION_FILE",
  "OTHER",
]);

function asAttachmentKind(value: unknown): WorkOrderAttachmentKind {
  const raw = stringOrNull(value);
  return raw && ATTACHMENT_KINDS.has(raw as WorkOrderAttachmentKind)
    ? (raw as WorkOrderAttachmentKind)
    : "OTHER";
}

export async function addServerWorkOrderAttachmentForOffice(
  key: string,
  body: {
    fileName?: unknown;
    kind?: unknown;
    mimeType?: unknown;
    sizeBytes?: unknown;
    storageRef?: unknown;
    notes?: unknown;
  },
  actor: string,
): Promise<ServerWriteResult> {
  const order = await resolveWorkOrderRow(key);
  if (!order) return { ok: false, error: "Work order not found.", status: 404 };

  const fileName = stringOrNull(body.fileName)?.trim();
  if (!fileName) return { ok: false, error: "File name is required.", status: 400 };

  const kind = asAttachmentKind(body.kind);
  const timelineType = kind === "PHOTO" ? "PHOTO_UPLOADED" : "FILE_UPLOADED";

  await prisma.$transaction([
    prisma.workOrderFile.create({
      data: {
        workOrderId: order.id,
        kind,
        fileName,
        mimeType: stringOrNull(body.mimeType),
        sizeBytes:
          numberOrNull(body.sizeBytes) != null
            ? Math.max(0, Math.floor(numberOrNull(body.sizeBytes)!))
            : null,
        uploadedBy: actor,
        storageRef: stringOrNull(body.storageRef),
        notes: stringOrNull(body.notes),
      },
    }),
    prisma.workOrderTimelineEvent.create({
      data: {
        workOrderId: order.id,
        type: timelineType,
        title: kind === "PHOTO" ? "Photo uploaded" : "Attachment uploaded",
        description: fileName,
        actor,
        newValue: fileName,
      },
    }),
    prisma.workOrderAuditEntry.create({
      data: {
        workOrderId: order.id,
        field: "attachments",
        previousValue: null,
        newValue: fileName,
        actor,
        action: "ATTACHMENT_ADDED",
      },
    }),
    prisma.workOrder.update({ where: { id: order.id }, data: { updatedAt: new Date() } }),
  ]);

  const workOrder = await reloadWorkOrder(order.id);
  if (!workOrder) {
    return { ok: false, error: "Work order not found after attachment add.", status: 404 };
  }
  return { ok: true, workOrder };
}
