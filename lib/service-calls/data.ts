import { getDigitalTwinMachine } from "@/lib/digital-twin/data";
import type { DigitalTwinMachine } from "@/lib/digital-twin/types";
import type {
  CreateServiceCallInput,
  ServiceCall,
  ServiceCallActivity,
  ServiceCallMachineSnapshot,
  ServiceCallPart,
  ServiceCallStatus,
} from "./types";

/**
 * Development-only sample service calls.
 * Serial numbers, customers, and contacts are fictional.
 */

function snapshotFromMachine(
  machine: DigitalTwinMachine,
): ServiceCallMachineSnapshot {
  return {
    machineId: machine.identity.machineId,
    assetTag: machine.identity.assetTag,
    serialNumber: machine.identity.serialNumber,
    printerModel: machine.identity.printerModel,
    nickname: machine.identity.nickname,
    customerName: machine.location.customerName,
    siteName: machine.location.siteName,
    machineLocation: machine.location.physicalLocation,
    currentMeterCount: machine.operational.currentMeterCount,
    organization: machine.location.organization,
    region: machine.assignment.assignedRegion,
  };
}

function activity(
  serviceCallId: string,
  activityType: ServiceCallActivity["activityType"],
  description: string,
  user: string,
  timestamp: string,
  metadata?: ServiceCallActivity["metadata"],
): ServiceCallActivity {
  return {
    id: `act-${serviceCallId}-${activityType}-${timestamp.replace(/\D/g, "")}`,
    serviceCallId,
    activityType,
    description,
    user,
    timestamp,
    metadata,
  };
}

function emptyResolution() {
  return {
    diagnosis: "",
    rootCause: "",
    workPerformed: "",
    resolutionSummary: "",
    finalMachineStatus: "" as const,
    technicianRecommendations: "",
    followUpRequired: false,
    followUpDate: "",
    technicianName: "",
    completedAt: "",
  };
}

function snapshotForCall(machineId: string): ServiceCallMachineSnapshot {
  const machine = getDigitalTwinMachine(machineId);
  if (machine) return snapshotFromMachine(machine);
  return {
    machineId,
    assetTag: machineId,
    serialNumber: "Not recorded",
    printerModel: "Not recorded",
    nickname: machineId,
    customerName: "SFX/MPX",
    siteName: "Not in the active printer catalog",
    machineLocation: "Not recorded",
    currentMeterCount: Number.NaN,
    organization: "SFX / MPX",
    region: "Portland, Maine",
  };
}

function buildCall(input: {
  id: string;
  workOrderNumber: string;
  ticketNumber: string;
  machineId: string;
  status: ServiceCallStatus;
  priority: ServiceCall["priority"];
  serviceType: ServiceCall["serviceType"];
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  closedAt?: string;
  issueTitle: string;
  problemDescription: string;
  errorCode?: string;
  symptoms?: string;
  customerImpact?: string;
  machineCurrentlyDown?: boolean;
  machineOperationalStatus?: string;
  reportedBy: string;
  reporterPhone?: string;
  reporterEmail?: string;
  technician: string;
  serviceManager?: string;
  warehouse?: string;
  truck?: string;
  requestedServiceDate?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  estimatedDurationHours?: number;
  actualLaborHours?: number;
  parts?: ServiceCallPart[];
  notes?: ServiceCall["notes"];
  activity?: ServiceCallActivity[];
  resolution?: Partial<ServiceCall["resolution"]>;
  completionAcknowledged?: boolean;
  isDraft?: boolean;
}): ServiceCall {
  const snap = snapshotForCall(input.machineId);

  return {
    id: input.id,
    workOrderNumber: input.workOrderNumber,
    ticketNumber: input.ticketNumber,
    createdAt: input.createdAt,
    createdBy: input.createdBy,
    updatedAt: input.updatedAt,
    closedAt: input.closedAt ?? "",
    status: input.status,
    priority: input.priority,
    serviceType: input.serviceType,
    machine: snap,
    problem: {
      issueTitle: input.issueTitle,
      problemDescription: input.problemDescription,
      errorCode: input.errorCode ?? "",
      symptoms: input.symptoms ?? "",
      customerImpact: input.customerImpact ?? "",
      machineOperationalStatus:
        input.machineOperationalStatus ??
        (input.machineCurrentlyDown ? "DOWN" : "DEGRADED"),
      machineCurrentlyDown: Boolean(input.machineCurrentlyDown),
    },
    contact: {
      reportedBy: input.reportedBy,
      reporterPhone: input.reporterPhone ?? "",
      reporterEmail: input.reporterEmail ?? "",
      customerContactName: input.reportedBy,
    },
    assignment: {
      technician: input.technician,
      serviceManager: input.serviceManager ?? "Jordan Hale",
      organization: snap.organization,
      region: snap.region,
      warehouse: input.warehouse ?? "SFX Central Warehouse",
      truck: input.truck ?? "Truck-07",
    },
    schedule: {
      requestedServiceDate: input.requestedServiceDate ?? input.createdAt.slice(0, 10),
      scheduledStart: input.scheduledStart ?? "",
      scheduledEnd: input.scheduledEnd ?? "",
      arrivalDateTime: "",
      departureDateTime: "",
      estimatedDurationHours: input.estimatedDurationHours ?? 2,
      actualLaborHours: input.actualLaborHours ?? 0,
    },
    resolution: { ...emptyResolution(), ...input.resolution },
    parts: input.parts ?? [],
    notes: input.notes ?? [],
    activity: input.activity ?? [
      activity(
        input.id,
        "CALL_CREATED",
        `Service call ${input.workOrderNumber} created`,
        input.createdBy,
        input.createdAt,
      ),
    ],
    attachments: [
      {
        id: `${input.id}-att-photo`,
        label: "Site photo",
        kind: "photo",
        description: "Photo upload placeholder — not connected yet",
        placeholder: true,
      },
    ],
    customerConfirmation: {
      customerContactName: input.reportedBy,
      customerSignaturePlaceholder: "Signature capture placeholder",
      technicianSignaturePlaceholder: "Technician signature placeholder",
      completionAcknowledged: Boolean(input.completionAcknowledged),
      managerOverrideClose: false,
      satisfactionRating: null,
      customerComments: "",
    },
    isDraft: Boolean(input.isDraft),
  };
}

/** Seed sample fleet — linked to Patch 31 Digital Twin machine IDs. */
export const sampleServiceCalls: ServiceCall[] = [];

export function snapshotMachineForServiceCall(
  machineId: string,
): ServiceCallMachineSnapshot | null {
  const machine = getDigitalTwinMachine(machineId);
  if (!machine) return null;
  return snapshotFromMachine(machine);
}

export function nextServiceCallIds(existing: ServiceCall[]): {
  id: string;
  workOrderNumber: string;
  ticketNumber: string;
} {
  const seq =
    existing.reduce((max, call) => {
      const n = Number(call.id.replace(/\D/g, "").slice(-4));
      return Number.isFinite(n) ? Math.max(max, n) : max;
    }, 0) + 1;
  const padded = String(seq).padStart(4, "0");
  return {
    id: `SC-2026-${padded}`,
    workOrderNumber: `WO-2026-${1000 + seq}`,
    ticketNumber: `TKT-2026-${1400 + seq}`,
  };
}

export function buildServiceCallFromInput(
  input: CreateServiceCallInput,
  existing: ServiceCall[],
): ServiceCall | { error: string } {
  const snap = snapshotMachineForServiceCall(input.machineId);
  if (!snap) {
    return { error: `Digital Twin machine not found: ${input.machineId}` };
  }

  const ids = nextServiceCallIds(existing);
  const now = new Date().toISOString();
  const priority =
    input.machineCurrentlyDown && input.priority !== "EMERGENCY"
      ? "EMERGENCY"
      : input.priority;

  const status: ServiceCallStatus = input.technician
    ? "ASSIGNED"
    : input.isDraft
      ? "NEW"
      : "UNASSIGNED";

  const call: ServiceCall = {
    id: ids.id,
    workOrderNumber: ids.workOrderNumber,
    ticketNumber: ids.ticketNumber,
    createdAt: now,
    createdBy: input.createdBy,
    updatedAt: now,
    closedAt: "",
    status: input.isDraft ? "NEW" : status,
    priority,
    serviceType: input.serviceType,
    machine: snap,
    problem: {
      issueTitle: input.issueTitle,
      problemDescription: input.problemDescription,
      errorCode: input.errorCode,
      symptoms: input.symptoms,
      customerImpact: input.customerImpact,
      machineOperationalStatus: input.machineCurrentlyDown ? "DOWN" : "DEGRADED",
      machineCurrentlyDown: input.machineCurrentlyDown,
    },
    contact: {
      reportedBy: input.reportedBy,
      reporterPhone: input.reporterPhone,
      reporterEmail: input.reporterEmail,
      customerContactName: input.reportedBy,
    },
    assignment: {
      technician: input.technician,
      serviceManager: input.serviceManager,
      organization: input.organization || snap.organization,
      region: input.region || snap.region,
      warehouse: "SFX Central Warehouse",
      truck: "Truck-07",
    },
    schedule: {
      requestedServiceDate: input.requestedServiceDate,
      scheduledStart: input.scheduledStart,
      scheduledEnd: "",
      arrivalDateTime: "",
      departureDateTime: "",
      estimatedDurationHours: input.estimatedDurationHours || 2,
      actualLaborHours: 0,
    },
    resolution: emptyResolution(),
    parts: [],
    notes: [],
    activity: [
      activity(
        ids.id,
        "CALL_CREATED",
        input.isDraft
          ? `Draft service call ${ids.workOrderNumber} saved`
          : `Service call ${ids.workOrderNumber} created`,
        input.createdBy,
        now,
      ),
    ],
    attachments: [
      {
        id: `${ids.id}-att-photo`,
        label: "Photo upload",
        kind: "photo",
        description: "Photo upload placeholder — not connected yet",
        placeholder: true,
      },
      {
        id: `${ids.id}-att-doc`,
        label: "Document upload",
        kind: "document",
        description: "Document upload placeholder — not connected yet",
        placeholder: true,
      },
    ],
    customerConfirmation: {
      customerContactName: input.reportedBy,
      customerSignaturePlaceholder: "Signature capture placeholder",
      technicianSignaturePlaceholder: "Technician signature placeholder",
      completionAcknowledged: false,
      managerOverrideClose: false,
      satisfactionRating: null,
      customerComments: "",
    },
    isDraft: input.isDraft,
  };

  if (input.technician && !input.isDraft) {
    call.activity.push(
      activity(
        ids.id,
        "CALL_ASSIGNED",
        `Assigned to ${input.technician}`,
        input.createdBy,
        now,
      ),
    );
  }

  return call;
}
