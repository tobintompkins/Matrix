import { digitalTwinFleet } from "@/lib/digital-twin/data";
import type { CreateWorkOrderInput, WorkOrder } from "./types";
import { nextWorkOrderNumber } from "./helpers";

function twin(id: string) {
  return digitalTwinFleet.find(
    (m) => m.identity.machineId.toUpperCase() === id.toUpperCase(),
  );
}

function baseFromTwin(
  machineId: string,
  overrides: Partial<WorkOrder> &
    Pick<WorkOrder, "id" | "workOrderNumber" | "title" | "serviceType" | "priority" | "status">,
): WorkOrder {
  const m = twin(machineId);
  const now = new Date().toISOString();
  return {
    id: overrides.id,
    workOrderNumber: overrides.workOrderNumber,
    title: overrides.title,
    description: overrides.description ?? "",
    customerId: overrides.customerId ?? "cust-sfx",
    customerName: m?.location.customerName ?? "SFX / MPX",
    siteId: overrides.siteId ?? "site-1",
    siteName: m?.location.siteName ?? "Main Site",
    siteAddress: m?.location.shipToAddress ?? "",
    region: m?.assignment.assignedRegion ?? "Northeast",
    printerId: machineId,
    printerName: m?.identity.nickname ?? machineId,
    printerModel: m?.identity.printerModel ?? null,
    assetTag: m?.identity.assetTag ?? null,
    serviceType: overrides.serviceType,
    priority: overrides.priority,
    status: overrides.status,
    source: overrides.source ?? "DISPATCH",
    assignedTechnician:
      overrides.assignedTechnician ??
      m?.assignment.assignedTechnician ??
      "Toby Tompkins",
    secondaryTechnician: overrides.secondaryTechnician ?? "",
    requestedBy: overrides.requestedBy ?? "Dispatch",
    createdBy: overrides.createdBy ?? "Matrix Planner",
    scheduledStart: overrides.scheduledStart ?? null,
    scheduledEnd: overrides.scheduledEnd ?? null,
    actualStart: overrides.actualStart ?? null,
    actualEnd: overrides.actualEnd ?? null,
    completedDate: overrides.completedDate ?? null,
    estimatedHours: overrides.estimatedHours ?? 2,
    actualHours: overrides.actualHours ?? null,
    travelTime: overrides.travelTime ?? null,
    mileage: overrides.mileage ?? null,
    laborRate: overrides.laborRate ?? 125,
    laborCost: overrides.laborCost ?? null,
    notes: overrides.notes ?? "",
    internalNotes: overrides.internalNotes ?? "",
    customerVisibleNotes: overrides.customerVisibleNotes ?? "",
    customerSignature: overrides.customerSignature ?? null,
    signatureCapturedAt: overrides.signatureCapturedAt ?? null,
    signatureCapturedBy: overrides.signatureCapturedBy ?? null,
    copyCountAtStart: overrides.copyCountAtStart ?? m?.operational.currentMeterCount ?? null,
    copyCountAtEnd: overrides.copyCountAtEnd ?? null,
    parts: overrides.parts ?? [],
    attachments: overrides.attachments ?? [],
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

const today = new Date();
const isoDay = (offset: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() + offset);
  return d.toISOString();
};

export const sampleWorkOrders: WorkOrder[] = [
  baseFromTwin("MX-GD-002", {
    id: "wo-001",
    workOrderNumber: "WO-2026-000001",
    title: "Break/Fix — feed jam recurring",
    description: "Customer reports intermittent feed jams on GD9630.",
    serviceType: "BREAK_FIX",
    priority: "HIGH",
    status: "SCHEDULED",
    scheduledStart: isoDay(0),
    scheduledEnd: isoDay(0),
    estimatedHours: 2.5,
  }),
  baseFromTwin("MX-GD-001", {
    id: "wo-002",
    workOrderNumber: "WO-2026-000002",
    title: "Preventive Maintenance visit",
    description: "Scheduled PM based on copy-count due status.",
    serviceType: "PREVENTIVE_MAINTENANCE",
    priority: "NORMAL",
    status: "ASSIGNED",
    scheduledStart: isoDay(1),
    scheduledEnd: isoDay(1),
    estimatedHours: 3,
    source: "MAINTENANCE_PLAN",
  }),
  baseFromTwin("MX-GL-001", {
    id: "wo-003",
    workOrderNumber: "WO-2026-000003",
    title: "Critical — machine down",
    description: "Production line stopped. Urgent on-site required.",
    serviceType: "BREAK_FIX",
    priority: "CRITICAL",
    status: "TRAVELING",
    scheduledStart: isoDay(-1),
    scheduledEnd: isoDay(-1),
    actualStart: isoDay(0),
    estimatedHours: 4,
  }),
  baseFromTwin("MX-VA-001", {
    id: "wo-004",
    workOrderNumber: "WO-2026-000004",
    title: "Waiting for transfer kit",
    description: "Diagnosis complete; awaiting parts arrival.",
    serviceType: "BREAK_FIX",
    priority: "HIGH",
    status: "WAITING_FOR_PARTS",
    scheduledStart: isoDay(-2),
    parts: [
      {
        id: "wop-1",
        partNumber: "S-1234",
        description: "Transfer kit",
        quantity: 1,
        unitCost: 420,
        source: "warehouse",
        addedBy: "Toby Tompkins",
        addedAt: isoDay(-1),
      },
    ],
  }),
  baseFromTwin("MX-GD-004", {
    id: "wo-005",
    workOrderNumber: "WO-2026-000005",
    title: "Cleaning completed",
    description: "Routine cleaning completed this morning.",
    serviceType: "CLEANING",
    priority: "LOW",
    status: "COMPLETED",
    scheduledStart: isoDay(0),
    actualStart: isoDay(0),
    actualEnd: isoDay(0),
    completedDate: isoDay(0),
    actualHours: 1.5,
    laborCost: 187.5,
  }),
  baseFromTwin("MX-T22-001", {
    id: "wo-006",
    workOrderNumber: "WO-2026-000006",
    title: "Operator training",
    description: "New operator training session.",
    serviceType: "TRAINING",
    priority: "NORMAL",
    status: "NEW",
    assignedTechnician: "Field Tech B",
    estimatedHours: 2,
  }),
];

export function buildWorkOrderFromInput(
  input: CreateWorkOrderInput,
  existingNumbers: string[],
): WorkOrder {
  const now = new Date().toISOString();
  const number = nextWorkOrderNumber(existingNumbers);
  const id = `wo-${Date.now()}`;
  const m = input.printerId ? twin(input.printerId) : undefined;

  return {
    id,
    workOrderNumber: number,
    title: input.title.trim(),
    description: input.description.trim(),
    customerId: input.customerId ?? "cust-sfx",
    customerName: input.customerName.trim(),
    siteId: input.siteId ?? "site-1",
    siteName: input.siteName.trim(),
    siteAddress: input.siteAddress ?? m?.location.shipToAddress ?? "",
    region: input.region ?? m?.assignment.assignedRegion ?? "",
    printerId: input.printerId ?? null,
    printerName: input.printerName ?? m?.identity.nickname ?? null,
    printerModel: input.printerModel ?? m?.identity.printerModel ?? null,
    assetTag: input.assetTag ?? m?.identity.assetTag ?? null,
    serviceType: input.serviceType,
    priority: input.priority,
    status: input.asDraft ? "DRAFT" : input.assignedTechnician ? "ASSIGNED" : "NEW",
    source: input.source ?? "CUSTOMER_REQUEST",
    assignedTechnician: input.assignedTechnician?.trim() ?? "",
    secondaryTechnician: input.secondaryTechnician?.trim() ?? "",
    requestedBy: input.requestedBy?.trim() ?? input.createdBy,
    createdBy: input.createdBy,
    scheduledStart: input.scheduledStart ?? null,
    scheduledEnd: input.scheduledEnd ?? null,
    actualStart: null,
    actualEnd: null,
    completedDate: null,
    estimatedHours: input.estimatedHours ?? null,
    actualHours: null,
    travelTime: null,
    mileage: null,
    laborRate: 125,
    laborCost: null,
    notes: input.notes?.trim() ?? "",
    internalNotes: input.internalNotes?.trim() ?? "",
    customerVisibleNotes: input.customerVisibleNotes?.trim() ?? "",
    customerSignature: null,
    signatureCapturedAt: null,
    signatureCapturedBy: null,
    copyCountAtStart: m?.operational.currentMeterCount ?? null,
    copyCountAtEnd: null,
    parts: [],
    attachments: [],
    createdAt: now,
    updatedAt: now,
  };
}
