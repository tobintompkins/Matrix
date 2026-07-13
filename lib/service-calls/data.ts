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

function requireMachine(machineId: string): DigitalTwinMachine {
  const machine = getDigitalTwinMachine(machineId);
  if (!machine) {
    throw new Error(`Sample data references missing Digital Twin machine ${machineId}`);
  }
  return machine;
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
  const machine = requireMachine(input.machineId);
  const snap = snapshotFromMachine(machine);

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
export const sampleServiceCalls: ServiceCall[] = [
  // GD9630 #1 — emergency / down
  buildCall({
    id: "SC-2026-0001",
    workOrderNumber: "WO-2026-1001",
    ticketNumber: "TKT-2026-0142",
    machineId: "MX-GD-002",
    status: "DIAGNOSING",
    priority: "EMERGENCY",
    serviceType: "BREAK_FIX",
    createdAt: "2026-07-05T09:15:00.000Z",
    createdBy: "Dispatch Bot",
    updatedAt: "2026-07-09T14:20:00.000Z",
    issueTitle: "GD9630 Tray 2 jam — machine down",
    problemDescription:
      "Repeated Tray 2 jams on high-volume runs. Operator stopped production. Fictional sample call for development.",
    errorCode: "E-TRAY2-JAM",
    symptoms: "Paper crumples at Tray 2 entrance; jam sensor trips within 20 sheets.",
    customerImpact: "Production line stopped — emergency response requested.",
    machineCurrentlyDown: true,
    machineOperationalStatus: "DOWN",
    reportedBy: "Alex Rivera",
    reporterPhone: "555-010-2002",
    reporterEmail: "alex.rivera@example.invalid",
    technician: "Sam Ortiz",
    scheduledStart: "2026-07-09T15:00:00.000Z",
    requestedServiceDate: "2026-07-09",
    estimatedDurationHours: 3,
    parts: [
      {
        id: "scp-0001-1",
        partNumber: "RIS-GD-FU-1201",
        description: "Feed Tray Roller (sample)",
        quantity: 1,
        required: true,
        used: false,
        ordered: false,
        orderStatus: "NOT_ORDERED",
        emergency: true,
        stockSource: "truck",
      },
    ],
    notes: [
      {
        id: "scn-0001-1",
        author: "Sam Ortiz",
        createdAt: "2026-07-09T14:25:00.000Z",
        noteType: "DIAGNOSIS",
        body: "Suspect worn feed roller. Checking truck stock for RIS-GD-FU-1201.",
        internalOnly: true,
      },
    ],
    activity: [
      activity(
        "SC-2026-0001",
        "CALL_CREATED",
        "Emergency service call created",
        "Dispatch Bot",
        "2026-07-05T09:15:00.000Z",
      ),
      activity(
        "SC-2026-0001",
        "CALL_ASSIGNED",
        "Assigned to Sam Ortiz",
        "Jordan Hale",
        "2026-07-05T09:40:00.000Z",
      ),
      activity(
        "SC-2026-0001",
        "TECHNICIAN_ACCEPTED",
        "Technician accepted call",
        "Sam Ortiz",
        "2026-07-05T10:05:00.000Z",
      ),
      activity(
        "SC-2026-0001",
        "TRAVEL_STARTED",
        "Travel started",
        "Sam Ortiz",
        "2026-07-09T13:30:00.000Z",
      ),
      activity(
        "SC-2026-0001",
        "ARRIVED_ON_SITE",
        "Arrived on site",
        "Sam Ortiz",
        "2026-07-09T14:10:00.000Z",
      ),
      activity(
        "SC-2026-0001",
        "STATUS_CHANGED",
        "Status changed to DIAGNOSING",
        "Sam Ortiz",
        "2026-07-09T14:20:00.000Z",
        { from: "ON_SITE", to: "DIAGNOSING" },
      ),
    ],
  }),

  // GD9630 #2 — assigned / normal break-fix
  buildCall({
    id: "SC-2026-0002",
    workOrderNumber: "WO-2026-1002",
    ticketNumber: "TKT-2026-0148",
    machineId: "MX-GD-004",
    status: "ASSIGNED",
    priority: "HIGH",
    serviceType: "BREAK_FIX",
    createdAt: "2026-07-07T11:00:00.000Z",
    createdBy: "Jordan Hale",
    updatedAt: "2026-07-08T08:00:00.000Z",
    issueTitle: "Intermittent paper feed error",
    problemDescription:
      "High-volume runs report intermittent feed errors. Sample development data only.",
    errorCode: "E-FEED-INT",
    symptoms: "Occasional misfeeds from Tray 1 after ~500 sheets.",
    customerImpact: "Reduced throughput; operator babysitting jobs.",
    reportedBy: "Casey Nguyen",
    reporterPhone: "555-010-4004",
    reporterEmail: "casey.nguyen@example.invalid",
    technician: "Sam Ortiz",
    scheduledStart: "2026-07-10T13:00:00.000Z",
    requestedServiceDate: "2026-07-10",
  }),

  // GL9730
  buildCall({
    id: "SC-2026-0003",
    workOrderNumber: "WO-2026-1003",
    ticketNumber: "TKT-2026-0138",
    machineId: "MX-GL-001",
    status: "ACCEPTED",
    priority: "NORMAL",
    serviceType: "BREAK_FIX",
    createdAt: "2026-07-04T10:30:00.000Z",
    createdBy: "Dispatch Bot",
    updatedAt: "2026-07-08T16:00:00.000Z",
    issueTitle: "GL9730 registration alignment issue",
    problemDescription:
      "Side-to-side registration drift on duplex jobs. Fictional sample.",
    errorCode: "E-REG-ALIGN",
    symptoms: "Image shifts ~1.5mm on back side.",
    customerImpact: "Reprint waste on color proofs.",
    reportedBy: "Morgan Lee",
    reporterPhone: "555-010-9730",
    reporterEmail: "morgan.lee@example.invalid",
    technician: "Riley Chen",
    scheduledStart: "2026-07-10T09:00:00.000Z",
    requestedServiceDate: "2026-07-10",
  }),

  // Valezus #1 — waiting for parts
  buildCall({
    id: "SC-2026-0004",
    workOrderNumber: "WO-2026-1004",
    ticketNumber: "TKT-2026-0135",
    machineId: "MX-VA-003",
    status: "WAITING_FOR_PARTS",
    priority: "HIGH",
    serviceType: "BREAK_FIX",
    createdAt: "2026-06-30T14:00:00.000Z",
    createdBy: "Jordan Hale",
    updatedAt: "2026-07-08T11:30:00.000Z",
    issueTitle: "Drum unit replacement — waiting on parts",
    problemDescription:
      "Drum wear indicators triggered. Replacement drum on order. Sample data.",
    errorCode: "E-DRUM-LIFE",
    symptoms: "Background density rising; drum life warning.",
    customerImpact: "Quality holds on premium jobs.",
    reportedBy: "Pat Brooks",
    reporterPhone: "555-010-3003",
    reporterEmail: "pat.brooks@example.invalid",
    technician: "Riley Chen",
    scheduledStart: "2026-07-02T10:00:00.000Z",
    requestedServiceDate: "2026-07-02",
    parts: [
      {
        id: "scp-0004-1",
        partNumber: "VAL-DRUM-01",
        description: "Valezus Drum Unit (sample)",
        quantity: 1,
        required: true,
        used: false,
        ordered: true,
        orderStatus: "ORDERED",
        emergency: false,
        stockSource: "ordered",
      },
    ],
    activity: [
      activity(
        "SC-2026-0004",
        "CALL_CREATED",
        "Service call created",
        "Jordan Hale",
        "2026-06-30T14:00:00.000Z",
      ),
      activity(
        "SC-2026-0004",
        "PART_ORDERED",
        "Ordered VAL-DRUM-01",
        "Riley Chen",
        "2026-07-02T12:00:00.000Z",
      ),
      activity(
        "SC-2026-0004",
        "WAITING_FOR_PARTS",
        "Status set to WAITING_FOR_PARTS",
        "Riley Chen",
        "2026-07-02T12:05:00.000Z",
      ),
    ],
  }),

  // Valezus #2 — network support
  buildCall({
    id: "SC-2026-0005",
    workOrderNumber: "WO-2026-1005",
    ticketNumber: "TKT-2026-0151",
    machineId: "MX-VA-002",
    status: "EN_ROUTE",
    priority: "NORMAL",
    serviceType: "NETWORK_SUPPORT",
    createdAt: "2026-07-08T08:45:00.000Z",
    createdBy: "Dispatch Bot",
    updatedAt: "2026-07-09T08:00:00.000Z",
    issueTitle: "Valezus network dropouts / RRA intermittent",
    problemDescription:
      "Intermittent network disconnects reported by operators. Development sample only.",
    errorCode: "NET-TIMEOUT",
    symptoms: "Job queue stalls; RRA shows intermittent.",
    customerImpact: "Remote monitoring unreliable.",
    reportedBy: "Jamie Cole",
    reporterPhone: "555-010-2002",
    reporterEmail: "jamie.cole@example.invalid",
    technician: "Taylor Brooks",
    scheduledStart: "2026-07-09T10:00:00.000Z",
    requestedServiceDate: "2026-07-09",
  }),

  // Closed call — GD9630
  buildCall({
    id: "SC-2026-0006",
    workOrderNumber: "WO-2026-0990",
    ticketNumber: "TKT-2026-0120",
    machineId: "MX-GD-006",
    status: "CLOSED",
    priority: "NORMAL",
    serviceType: "BREAK_FIX",
    createdAt: "2026-06-25T09:00:00.000Z",
    createdBy: "Jordan Hale",
    updatedAt: "2026-06-27T16:30:00.000Z",
    closedAt: "2026-06-27T16:30:00.000Z",
    issueTitle: "Master roll tension sensor fault cleared",
    problemDescription:
      "Tension sensor false trips. Cleared after sensor reseat. Sample closed call.",
    errorCode: "E-TENS-SENS",
    symptoms: "False tension alarms mid-run.",
    customerImpact: "Minor delays.",
    reportedBy: "Alex Rivera",
    technician: "Sam Ortiz",
    scheduledStart: "2026-06-26T11:00:00.000Z",
    requestedServiceDate: "2026-06-26",
    actualLaborHours: 1.5,
    completionAcknowledged: true,
    resolution: {
      diagnosis: "Loose sensor connector",
      rootCause: "Connector not fully seated after prior PM",
      workPerformed: "Reseated connector; verified tension readings",
      resolutionSummary: "Sensor fault cleared; machine returned to service",
      finalMachineStatus: "OPERATIONAL",
      technicianRecommendations: "Check connector torque at next PM",
      followUpRequired: false,
      followUpDate: "",
      technicianName: "Sam Ortiz",
      completedAt: "2026-06-27T15:45:00.000Z",
    },
    activity: [
      activity(
        "SC-2026-0006",
        "CALL_CREATED",
        "Service call created",
        "Jordan Hale",
        "2026-06-25T09:00:00.000Z",
      ),
      activity(
        "SC-2026-0006",
        "CALL_RESOLVED",
        "Call resolved — OPERATIONAL",
        "Sam Ortiz",
        "2026-06-27T15:45:00.000Z",
      ),
      activity(
        "SC-2026-0006",
        "CALL_CLOSED",
        "Call closed with customer acknowledgement",
        "Jordan Hale",
        "2026-06-27T16:30:00.000Z",
      ),
    ],
  }),

  // PM-related
  buildCall({
    id: "SC-2026-0007",
    workOrderNumber: "WO-2026-1007",
    ticketNumber: "TKT-2026-0155",
    machineId: "MX-GD-001",
    status: "NEW",
    priority: "LOW",
    serviceType: "PREVENTIVE_MAINTENANCE",
    createdAt: "2026-07-09T07:00:00.000Z",
    createdBy: "PM Scheduler",
    updatedAt: "2026-07-09T07:00:00.000Z",
    issueTitle: "Scheduled PM — GD9630 meter window",
    problemDescription:
      "Preventive maintenance due based on meter window. Sample PM service call.",
    symptoms: "None — scheduled PM",
    customerImpact: "Planned downtime window.",
    reportedBy: "PM Scheduler",
    technician: "",
    serviceManager: "Jordan Hale",
    requestedServiceDate: "2026-07-11",
    scheduledStart: "2026-07-11T08:00:00.000Z",
    estimatedDurationHours: 4,
  }),

  // Unassigned Valezus follow-up style / second Valezus already have 2; add inspection on VA-001
  buildCall({
    id: "SC-2026-0008",
    workOrderNumber: "WO-2026-1008",
    ticketNumber: "TKT-2026-0158",
    machineId: "MX-VA-001",
    status: "UNASSIGNED",
    priority: "NORMAL",
    serviceType: "INSPECTION",
    createdAt: "2026-07-09T12:00:00.000Z",
    createdBy: "Jordan Hale",
    updatedAt: "2026-07-09T12:00:00.000Z",
    issueTitle: "Post-install quality inspection",
    problemDescription:
      "Customer requested inspection after recent install. Fictional sample.",
    customerImpact: "Scheduling only — machine online.",
    reportedBy: "Dana West",
    reporterEmail: "dana.west@example.invalid",
    technician: "",
    requestedServiceDate: "2026-07-12",
    scheduledStart: "2026-07-12T14:00:00.000Z",
  }),
];

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
