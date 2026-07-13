/**
 * Work order repository — sessionStorage prototype (Patch 37).
 * Prisma WorkOrder model is the future persistence target.
 */

import { buildWorkOrderFromInput, sampleWorkOrders } from "./data";
import {
  laborCostFrom,
  nextWorkOrderNumber,
  validateCreateWorkOrderInput,
} from "./helpers";
import type {
  CreateWorkOrderInput,
  PriorityConfig,
  ServiceTypeConfig,
  WorkOrder,
  WorkOrderAttachment,
  WorkOrderAttachmentKind,
  WorkOrderAuditEntry,
  WorkOrderPartLine,
  WorkOrderPriority,
  WorkOrderStatus,
  WorkOrderTimelineEvent,
} from "./types";
import {
  DEFAULT_PRIORITY_CONFIGS,
  DEFAULT_SERVICE_TYPE_CONFIGS,
} from "./types";
import {
  assertWorkOrderTransition,
  quickActionTarget,
} from "./workflow";

const ORDERS_KEY = "matrix.work-orders.v1";
const TIMELINE_KEY = "matrix.work-orders.timeline.v1";
const AUDIT_KEY = "matrix.work-orders.audit.v1";
const PRIORITY_KEY = "matrix.work-orders.priority-config.v1";
const TYPES_KEY = "matrix.work-orders.service-types.v1";
const SEQ_KEY = "matrix.work-orders.seq.v1";

let ordersStore: WorkOrder[] | null = null;
let timelineStore: WorkOrderTimelineEvent[] | null = null;
let auditStore: WorkOrderAuditEntry[] | null = null;
let priorityStore: PriorityConfig[] | null = null;
let typesStore: ServiceTypeConfig[] | null = null;

function clone<T>(v: T): T {
  return structuredClone(v);
}

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

function ensureOrders(): WorkOrder[] {
  if (ordersStore) return ordersStore;
  ordersStore = readJson<WorkOrder[]>(ORDERS_KEY) ?? clone(sampleWorkOrders);
  return ordersStore;
}

function ensureTimeline(): WorkOrderTimelineEvent[] {
  if (timelineStore) return timelineStore;
  timelineStore = readJson<WorkOrderTimelineEvent[]>(TIMELINE_KEY) ?? [];
  return timelineStore;
}

function ensureAudit(): WorkOrderAuditEntry[] {
  if (auditStore) return auditStore;
  auditStore = readJson<WorkOrderAuditEntry[]>(AUDIT_KEY) ?? [];
  return auditStore;
}

function ensurePriorities(): PriorityConfig[] {
  if (priorityStore) return priorityStore;
  priorityStore =
    readJson<PriorityConfig[]>(PRIORITY_KEY) ?? clone(DEFAULT_PRIORITY_CONFIGS);
  return priorityStore;
}

function ensureTypes(): ServiceTypeConfig[] {
  if (typesStore) return typesStore;
  typesStore =
    readJson<ServiceTypeConfig[]>(TYPES_KEY) ??
    clone(DEFAULT_SERVICE_TYPE_CONFIGS);
  return typesStore;
}

function commitOrders(next: WorkOrder[]): void {
  ordersStore = next;
  writeJson(ORDERS_KEY, next);
}

function commitTimeline(next: WorkOrderTimelineEvent[]): void {
  timelineStore = next;
  writeJson(TIMELINE_KEY, next);
}

function commitAudit(next: WorkOrderAuditEntry[]): void {
  auditStore = next;
  writeJson(AUDIT_KEY, next);
}

function pushTimeline(
  event: Omit<WorkOrderTimelineEvent, "id"> & { id?: string },
): void {
  const full: WorkOrderTimelineEvent = {
    id: event.id ?? `wot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    workOrderId: event.workOrderId,
    type: event.type,
    title: event.title,
    description: event.description,
    actor: event.actor,
    occurredAt: event.occurredAt,
    previousValue: event.previousValue ?? null,
    newValue: event.newValue ?? null,
  };
  commitTimeline([full, ...ensureTimeline()]);
}

function pushAudit(
  entry: Omit<WorkOrderAuditEntry, "id"> & { id?: string },
): void {
  const full: WorkOrderAuditEntry = {
    id: entry.id ?? `woa-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    workOrderId: entry.workOrderId,
    field: entry.field,
    previousValue: entry.previousValue,
    newValue: entry.newValue,
    actor: entry.actor,
    occurredAt: entry.occurredAt,
    action: entry.action,
  };
  commitAudit([full, ...ensureAudit()]);
}

function findIndex(idOrNumber: string): number {
  const key = idOrNumber.trim().toUpperCase();
  return ensureOrders().findIndex(
    (o) =>
      o.id.toUpperCase() === key ||
      o.workOrderNumber.toUpperCase() === key,
  );
}

function touch(order: WorkOrder): WorkOrder {
  return { ...order, updatedAt: new Date().toISOString() };
}

/** Reserved sequential numbers — never reuse even if an order is deleted. */
function reserveNumber(candidate: string): string {
  const used = [
    ...ensureOrders().map((o) => o.workOrderNumber),
    ...(readJson<string[]>(SEQ_KEY) ?? []),
  ];
  let next = candidate;
  const year = new Date().getFullYear();
  while (used.includes(next)) {
    next = nextWorkOrderNumber([...used, next], new Date(`${year}-01-01`));
  }
  writeJson(SEQ_KEY, [...new Set([...(readJson<string[]>(SEQ_KEY) ?? []), next])]);
  return next;
}

export function listWorkOrders(): WorkOrder[] {
  return clone(ensureOrders()).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
}

export function getWorkOrder(idOrNumber: string): WorkOrder | undefined {
  const idx = findIndex(idOrNumber);
  return idx < 0 ? undefined : clone(ensureOrders()[idx]);
}

export function listWorkOrderTimeline(
  workOrderId: string,
): WorkOrderTimelineEvent[] {
  return ensureTimeline()
    .filter((e) => e.workOrderId === workOrderId)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

export function listWorkOrderAudit(workOrderId: string): WorkOrderAuditEntry[] {
  return ensureAudit()
    .filter((e) => e.workOrderId === workOrderId)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

export function listPriorityConfigs(): PriorityConfig[] {
  return clone(ensurePriorities());
}

export function updatePriorityConfig(
  priority: WorkOrderPriority,
  patch: Partial<Omit<PriorityConfig, "priority">>,
): PriorityConfig {
  const list = ensurePriorities();
  const idx = list.findIndex((p) => p.priority === priority);
  const next = [...list];
  next[idx] = { ...next[idx], ...patch, priority };
  priorityStore = next;
  writeJson(PRIORITY_KEY, next);
  return clone(next[idx]);
}

export function listServiceTypeConfigs(): ServiceTypeConfig[] {
  return clone(ensureTypes());
}

export function addServiceTypeConfig(input: {
  code: string;
  label: string;
}): ServiceTypeConfig | { ok: false; error: string } {
  const code = input.code.trim().toUpperCase().replace(/\s+/g, "_");
  if (!code) return { ok: false, error: "Code is required." };
  if (ensureTypes().some((t) => t.code === code)) {
    return { ok: false, error: "Service type already exists." };
  }
  const entry: ServiceTypeConfig = {
    code,
    label: input.label.trim() || code,
    active: true,
    system: false,
  };
  const next = [...ensureTypes(), entry];
  typesStore = next;
  writeJson(TYPES_KEY, next);
  return entry;
}

export function createWorkOrder(
  input: CreateWorkOrderInput,
): { ok: true; workOrder: WorkOrder } | { ok: false; error: string } {
  const valid = validateCreateWorkOrderInput(input);
  if (!valid.ok) return valid;

  const existing = ensureOrders().map((o) => o.workOrderNumber);
  const built = buildWorkOrderFromInput(input, existing);
  built.workOrderNumber = reserveNumber(built.workOrderNumber);

  commitOrders([built, ...ensureOrders()]);
  const now = built.createdAt;
  pushTimeline({
    workOrderId: built.id,
    type: "CREATED",
    title: "Work Order Created",
    description: `${built.workOrderNumber} — ${built.title}`,
    actor: built.createdBy,
    occurredAt: now,
    newValue: built.status,
  });
  if (built.assignedTechnician) {
    pushTimeline({
      workOrderId: built.id,
      type: "ASSIGNED",
      title: "Technician Assigned",
      description: built.assignedTechnician,
      actor: built.createdBy,
      occurredAt: now,
      newValue: built.assignedTechnician,
    });
  }
  pushAudit({
    workOrderId: built.id,
    field: "status",
    previousValue: "",
    newValue: built.status,
    actor: built.createdBy,
    occurredAt: now,
    action: "CREATED",
  });

  return { ok: true, workOrder: clone(built) };
}

export function assignWorkOrder(input: {
  workOrderId: string;
  technician: string;
  secondaryTechnician?: string;
  actor: string;
}): { ok: true; workOrder: WorkOrder } | { ok: false; error: string } {
  const idx = findIndex(input.workOrderId);
  if (idx < 0) return { ok: false, error: "Work order not found." };
  if (!input.technician.trim()) {
    return { ok: false, error: "Technician is required." };
  }

  const orders = ensureOrders();
  const prev = orders[idx];
  let nextStatus = prev.status;
  if (prev.status === "NEW" || prev.status === "DRAFT") {
    const check = assertWorkOrderTransition(prev.status, "ASSIGNED");
    if (prev.status === "NEW" && !check.ok) {
      // DRAFT -> NEW first not required if going to ASSIGNED from NEW
    }
    if (prev.status === "NEW") nextStatus = "ASSIGNED";
    if (prev.status === "DRAFT") {
      const toNew = assertWorkOrderTransition("DRAFT", "NEW");
      if (!toNew.ok) return { ok: false, error: toNew.message };
      nextStatus = "ASSIGNED";
    }
  }

  const updated = touch({
    ...prev,
    assignedTechnician: input.technician.trim(),
    secondaryTechnician:
      input.secondaryTechnician?.trim() ?? prev.secondaryTechnician,
    status: nextStatus,
  });
  const list = [...orders];
  list[idx] = updated;
  commitOrders(list);

  const now = updated.updatedAt;
  pushTimeline({
    workOrderId: updated.id,
    type: "ASSIGNED",
    title: "Assignment Changed",
    description: `Assigned to ${updated.assignedTechnician}`,
    actor: input.actor,
    occurredAt: now,
    previousValue: prev.assignedTechnician,
    newValue: updated.assignedTechnician,
  });
  pushAudit({
    workOrderId: updated.id,
    field: "assignedTechnician",
    previousValue: prev.assignedTechnician,
    newValue: updated.assignedTechnician,
    actor: input.actor,
    occurredAt: now,
    action: "ASSIGNMENT_CHANGED",
  });
  if (prev.status !== updated.status) {
    pushTimeline({
      workOrderId: updated.id,
      type: "STATUS_CHANGED",
      title: "Status Changed",
      description: `${prev.status} → ${updated.status}`,
      actor: input.actor,
      occurredAt: now,
      previousValue: prev.status,
      newValue: updated.status,
    });
    pushAudit({
      workOrderId: updated.id,
      field: "status",
      previousValue: prev.status,
      newValue: updated.status,
      actor: input.actor,
      occurredAt: now,
      action: "STATUS_CHANGED",
    });
  }

  return { ok: true, workOrder: clone(updated) };
}

export function updateWorkOrderStatus(input: {
  workOrderId: string;
  status: WorkOrderStatus;
  actor: string;
  note?: string;
}): { ok: true; workOrder: WorkOrder } | { ok: false; error: string } {
  const idx = findIndex(input.workOrderId);
  if (idx < 0) return { ok: false, error: "Work order not found." };
  const orders = ensureOrders();
  const prev = orders[idx];
  const check = assertWorkOrderTransition(prev.status, input.status);
  if (!check.ok) return { ok: false, error: check.message };

  let patched: WorkOrder = { ...prev, status: input.status };
  const now = new Date().toISOString();
  if (input.status === "TRAVELING" && !patched.actualStart) {
    patched.actualStart = now;
  }
  if (input.status === "ON_SITE" && !patched.actualStart) {
    patched.actualStart = now;
  }
  if (input.status === "COMPLETED") {
    patched.actualEnd = now;
    patched.completedDate = now;
    patched.laborCost = laborCostFrom(patched.actualHours, patched.laborRate);
  }

  patched = touch(patched);
  const list = [...orders];
  list[idx] = patched;
  commitOrders(list);

  pushTimeline({
    workOrderId: patched.id,
    type: input.status === "COMPLETED" ? "COMPLETED" : "STATUS_CHANGED",
    title: input.status === "COMPLETED" ? "Work Completed" : "Status Changed",
    description:
      input.note?.trim() || `${prev.status} → ${input.status}`,
    actor: input.actor,
    occurredAt: now,
    previousValue: prev.status,
    newValue: input.status,
  });
  pushAudit({
    workOrderId: patched.id,
    field: "status",
    previousValue: prev.status,
    newValue: input.status,
    actor: input.actor,
    occurredAt: now,
    action: "STATUS_CHANGED",
  });

  return { ok: true, workOrder: clone(patched) };
}

export function runWorkOrderQuickAction(input: {
  workOrderId: string;
  action: "start" | "pause" | "resume" | "complete";
  actor: string;
}): { ok: true; workOrder: WorkOrder } | { ok: false; error: string } {
  const order = getWorkOrder(input.workOrderId);
  if (!order) return { ok: false, error: "Work order not found." };
  const target = quickActionTarget(input.action, order.status);
  if (!target) {
    return {
      ok: false,
      error: `Cannot ${input.action} from status ${order.status}.`,
    };
  }
  return updateWorkOrderStatus({
    workOrderId: order.id,
    status: target,
    actor: input.actor,
    note: `Quick action: ${input.action}`,
  });
}

export function addWorkOrderNote(input: {
  workOrderId: string;
  note: string;
  internal?: boolean;
  actor: string;
}): { ok: true; workOrder: WorkOrder } | { ok: false; error: string } {
  if (!input.note.trim()) return { ok: false, error: "Note is required." };
  const idx = findIndex(input.workOrderId);
  if (idx < 0) return { ok: false, error: "Work order not found." };
  const orders = ensureOrders();
  const prev = orders[idx];
  const updated = touch({
    ...prev,
    notes: input.internal
      ? prev.notes
      : [prev.notes, input.note.trim()].filter(Boolean).join("\n"),
    internalNotes: input.internal
      ? [prev.internalNotes, input.note.trim()].filter(Boolean).join("\n")
      : prev.internalNotes,
  });
  const list = [...orders];
  list[idx] = updated;
  commitOrders(list);
  pushTimeline({
    workOrderId: updated.id,
    type: "NOTE_ADDED",
    title: input.internal ? "Internal Note Added" : "Note Added",
    description: input.note.trim(),
    actor: input.actor,
    occurredAt: updated.updatedAt,
  });
  return { ok: true, workOrder: clone(updated) };
}

export function addWorkOrderPart(input: {
  workOrderId: string;
  partNumber: string;
  description: string;
  quantity: number;
  unitCost?: number;
  source?: string;
  actor: string;
}): { ok: true; workOrder: WorkOrder } | { ok: false; error: string } {
  const idx = findIndex(input.workOrderId);
  if (idx < 0) return { ok: false, error: "Work order not found." };
  if (!input.partNumber.trim()) {
    return { ok: false, error: "Part number is required." };
  }
  const part: WorkOrderPartLine = {
    id: `wop-${Date.now()}`,
    partNumber: input.partNumber.trim(),
    description: input.description.trim(),
    quantity: input.quantity || 1,
    unitCost: input.unitCost ?? 0,
    source: input.source ?? "truck",
    addedBy: input.actor,
    addedAt: new Date().toISOString(),
  };
  const orders = ensureOrders();
  const prev = orders[idx];
  const updated = touch({ ...prev, parts: [part, ...prev.parts] });
  const list = [...orders];
  list[idx] = updated;
  commitOrders(list);
  pushTimeline({
    workOrderId: updated.id,
    type: "PART_ADDED",
    title: "Part Added",
    description: `${part.partNumber} × ${part.quantity}`,
    actor: input.actor,
    occurredAt: updated.updatedAt,
    newValue: part.partNumber,
  });
  pushAudit({
    workOrderId: updated.id,
    field: "parts",
    previousValue: "",
    newValue: JSON.stringify(part),
    actor: input.actor,
    occurredAt: updated.updatedAt,
    action: "PART_ADDED",
  });
  return { ok: true, workOrder: clone(updated) };
}

export function updateWorkOrderLabor(input: {
  workOrderId: string;
  actualHours?: number | null;
  travelTime?: number | null;
  mileage?: number | null;
  laborRate?: number | null;
  actor: string;
}): { ok: true; workOrder: WorkOrder } | { ok: false; error: string } {
  const idx = findIndex(input.workOrderId);
  if (idx < 0) return { ok: false, error: "Work order not found." };
  const orders = ensureOrders();
  const prev = orders[idx];
  const actualHours =
    input.actualHours !== undefined ? input.actualHours : prev.actualHours;
  const laborRate =
    input.laborRate !== undefined ? input.laborRate : prev.laborRate;
  const updated = touch({
    ...prev,
    actualHours,
    travelTime:
      input.travelTime !== undefined ? input.travelTime : prev.travelTime,
    mileage: input.mileage !== undefined ? input.mileage : prev.mileage,
    laborRate,
    laborCost: laborCostFrom(actualHours, laborRate),
  });
  const list = [...orders];
  list[idx] = updated;
  commitOrders(list);
  pushTimeline({
    workOrderId: updated.id,
    type: "LABOR_UPDATED",
    title: "Labor Updated",
    description: `Hours ${updated.actualHours ?? "—"} · Cost ${updated.laborCost ?? "—"}`,
    actor: input.actor,
    occurredAt: updated.updatedAt,
    previousValue: String(prev.actualHours ?? ""),
    newValue: String(updated.actualHours ?? ""),
  });
  pushAudit({
    workOrderId: updated.id,
    field: "actualHours",
    previousValue: String(prev.actualHours ?? ""),
    newValue: String(updated.actualHours ?? ""),
    actor: input.actor,
    occurredAt: updated.updatedAt,
    action: "LABOR_CHANGED",
  });
  return { ok: true, workOrder: clone(updated) };
}

export function addWorkOrderAttachment(input: {
  workOrderId: string;
  kind: WorkOrderAttachmentKind;
  fileName: string;
  mimeType?: string;
  sizeBytes?: number;
  notes?: string;
  actor: string;
}): { ok: true; workOrder: WorkOrder } | { ok: false; error: string } {
  const idx = findIndex(input.workOrderId);
  if (idx < 0) return { ok: false, error: "Work order not found." };
  if (!input.fileName.trim()) {
    return { ok: false, error: "File name is required." };
  }
  const attachment: WorkOrderAttachment = {
    id: `woatt-${Date.now()}`,
    workOrderId: ensureOrders()[idx].id,
    kind: input.kind,
    fileName: input.fileName.trim(),
    mimeType: input.mimeType ?? "application/octet-stream",
    sizeBytes: input.sizeBytes ?? 0,
    uploadedBy: input.actor,
    uploadedAt: new Date().toISOString(),
    notes: input.notes?.trim() ?? "",
    storageRef: `local://${input.fileName.trim()}`,
  };
  const orders = ensureOrders();
  const prev = orders[idx];
  const updated = touch({
    ...prev,
    attachments: [attachment, ...prev.attachments],
  });
  const list = [...orders];
  list[idx] = updated;
  commitOrders(list);
  pushTimeline({
    workOrderId: updated.id,
    type: input.kind === "PHOTO" ? "PHOTO_UPLOADED" : "FILE_UPLOADED",
    title: input.kind === "PHOTO" ? "Photo Uploaded" : "File Uploaded",
    description: attachment.fileName,
    actor: input.actor,
    occurredAt: updated.updatedAt,
    newValue: attachment.fileName,
  });
  pushAudit({
    workOrderId: updated.id,
    field: "attachments",
    previousValue: "",
    newValue: attachment.fileName,
    actor: input.actor,
    occurredAt: updated.updatedAt,
    action: "ATTACHMENT_UPLOADED",
  });
  return { ok: true, workOrder: clone(updated) };
}

export function captureWorkOrderSignature(input: {
  workOrderId: string;
  signatureName: string;
  actor: string;
}): { ok: true; workOrder: WorkOrder } | { ok: false; error: string } {
  const idx = findIndex(input.workOrderId);
  if (idx < 0) return { ok: false, error: "Work order not found." };
  if (!input.signatureName.trim()) {
    return { ok: false, error: "Signature name is required." };
  }
  const orders = ensureOrders();
  const prev = orders[idx];
  const now = new Date().toISOString();
  const updated = touch({
    ...prev,
    customerSignature: input.signatureName.trim(),
    signatureCapturedAt: now,
    signatureCapturedBy: input.actor,
  });
  const list = [...orders];
  list[idx] = updated;
  commitOrders(list);
  pushTimeline({
    workOrderId: updated.id,
    type: "SIGNATURE_CAPTURED",
    title: "Customer Signature Captured",
    description: updated.customerSignature ?? "",
    actor: input.actor,
    occurredAt: now,
    newValue: updated.customerSignature,
  });
  pushAudit({
    workOrderId: updated.id,
    field: "customerSignature",
    previousValue: prev.customerSignature ?? "",
    newValue: updated.customerSignature ?? "",
    actor: input.actor,
    occurredAt: now,
    action: "SIGNATURE_CAPTURED",
  });
  return { ok: true, workOrder: clone(updated) };
}

export function recordWorkOrderCopyCount(input: {
  workOrderId: string;
  copyCount: number;
  at: "start" | "end";
  actor: string;
}): { ok: true; workOrder: WorkOrder } | { ok: false; error: string } {
  const idx = findIndex(input.workOrderId);
  if (idx < 0) return { ok: false, error: "Work order not found." };
  if (!Number.isInteger(input.copyCount) || input.copyCount < 0) {
    return { ok: false, error: "Copy count must be a non-negative whole number." };
  }
  const orders = ensureOrders();
  const prev = orders[idx];
  const updated = touch({
    ...prev,
    copyCountAtStart:
      input.at === "start" ? input.copyCount : prev.copyCountAtStart,
    copyCountAtEnd: input.at === "end" ? input.copyCount : prev.copyCountAtEnd,
  });
  const list = [...orders];
  list[idx] = updated;
  commitOrders(list);
  pushTimeline({
    workOrderId: updated.id,
    type: "COPY_COUNT_RECORDED",
    title: "Copy Count Recorded",
    description: `${input.at}: ${input.copyCount.toLocaleString("en-US")}`,
    actor: input.actor,
    occurredAt: updated.updatedAt,
    newValue: String(input.copyCount),
  });
  return { ok: true, workOrder: clone(updated) };
}

export function updateWorkOrderSchedule(input: {
  workOrderId: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  actor: string;
}): { ok: true; workOrder: WorkOrder } | { ok: false; error: string } {
  const idx = findIndex(input.workOrderId);
  if (idx < 0) return { ok: false, error: "Work order not found." };
  const orders = ensureOrders();
  const prev = orders[idx];
  let status = prev.status;
  if (
    input.scheduledStart &&
    (prev.status === "NEW" || prev.status === "ASSIGNED")
  ) {
    const check = assertWorkOrderTransition(prev.status, "SCHEDULED");
    if (check.ok) status = "SCHEDULED";
  }
  const updated = touch({
    ...prev,
    scheduledStart: input.scheduledStart,
    scheduledEnd: input.scheduledEnd,
    status,
  });
  const list = [...orders];
  list[idx] = updated;
  commitOrders(list);
  pushAudit({
    workOrderId: updated.id,
    field: "scheduledStart",
    previousValue: prev.scheduledStart ?? "",
    newValue: updated.scheduledStart ?? "",
    actor: input.actor,
    occurredAt: updated.updatedAt,
    action: "FIELD_CHANGED",
  });
  pushTimeline({
    workOrderId: updated.id,
    type: "FIELD_CHANGED",
    title: "Schedule Updated",
    description: `${updated.scheduledStart ?? "—"} → ${updated.scheduledEnd ?? "—"}`,
    actor: input.actor,
    occurredAt: updated.updatedAt,
  });
  return { ok: true, workOrder: clone(updated) };
}
