import { digitalTwinFleet } from "@/lib/digital-twin/data";
import { recalculateDueCounts } from "./calculations";
import { getDefaultIntervalForModel } from "./intervals";
import type {
  CopyCountHistory,
  MaintenanceCompletionRecord,
  MaintenanceTimelineEvent,
  PrinterMaintenanceProfile,
} from "./types";

/**
 * Development sample maintenance profiles linked to Digital Twin machine IDs.
 * Counts/dates are fictional foundation data only.
 */

function profileFromTwin(
  machineId: string,
  overrides: Partial<PrinterMaintenanceProfile> = {},
): PrinterMaintenanceProfile {
  const machine = digitalTwinFleet.find(
    (m) => m.identity.machineId === machineId,
  );
  if (!machine) {
    throw new Error(`Missing Digital Twin machine for maintenance seed: ${machineId}`);
  }

  const base: PrinterMaintenanceProfile = {
    printerId: machine.identity.machineId,
    assetTag: machine.identity.assetTag,
    nickname: machine.identity.nickname,
    printerModel: machine.identity.printerModel,
    customerName: machine.location.customerName,
    siteName: machine.location.siteName,
    currentCopyCount: machine.operational.currentMeterCount,
    previousCopyCount: Math.max(
      0,
      machine.operational.currentMeterCount -
        machine.operational.monthlyVolume,
    ),
    monthlyVolume: machine.operational.monthlyVolume,
    lastPMDate: machine.service.lastPmDate || null,
    lastCleaningDate: null,
    lastJointUnitDate: null,
    lastDTFPMDate: null,
    nextPMDue: null,
    nextCleaningDue: null,
    nextJointUnitDue: null,
    nextDTFDue: null,
    lastPMCopyCount: null,
    lastCleaningCopyCount: null,
    lastJointUnitCopyCount: null,
    lastDTFPMCopyCount: null,
    nextPMDueCount: null,
    nextCleaningDueCount: null,
    nextJointUnitDueCount: null,
    nextDTFDueCount: null,
    ...overrides,
  };

  const dues = recalculateDueCounts(
    base,
    getDefaultIntervalForModel(base.printerModel),
  );
  return { ...base, ...dues };
}

export const sampleMaintenanceProfiles: PrinterMaintenanceProfile[] = [
  profileFromTwin("MX-GD-001", {
    lastCleaningDate: "2026-06-20",
    lastJointUnitDate: "2026-03-15",
    lastPMCopyCount: 500_000,
    lastCleaningCopyCount: 750_000,
    lastJointUnitCopyCount: 400_000,
  }),
  profileFromTwin("MX-GD-002", {
    lastCleaningDate: "2026-06-28",
    lastJointUnitDate: "2026-04-02",
    lastPMCopyCount: 200_000,
    lastCleaningCopyCount: 900_000,
    lastJointUnitCopyCount: 200_000,
  }),
  profileFromTwin("MX-GD-003", {
    lastCleaningDate: "2026-05-10",
    lastPMCopyCount: 100_000,
    lastCleaningCopyCount: 100_000,
  }),
  profileFromTwin("MX-GD-004", {
    lastCleaningDate: "2026-07-01",
    lastJointUnitDate: "2026-01-22",
    lastPMCopyCount: 50_000,
    lastCleaningCopyCount: 800_000,
    lastJointUnitCopyCount: 50_000,
  }),
  profileFromTwin("MX-GD-005"),
  profileFromTwin("MX-GD-006", {
    lastCleaningDate: "2026-06-15",
    lastDTFPMDate: "2026-02-10",
    lastPMCopyCount: 300_000,
    lastCleaningCopyCount: 600_000,
    lastDTFPMCopyCount: 300_000,
  }),
  profileFromTwin("MX-GD-007"),
  profileFromTwin("MX-GL-001", {
    lastCleaningDate: "2026-06-05",
    lastJointUnitDate: "2026-05-01",
    lastPMCopyCount: 100_000,
    lastCleaningCopyCount: 450_000,
    lastJointUnitCopyCount: 100_000,
  }),
  profileFromTwin("MX-VA-001", {
    lastCleaningDate: "2026-07-02",
    lastDTFPMDate: "2026-06-18",
    lastPMCopyCount: 50_000,
    lastCleaningCopyCount: 50_000,
    lastDTFPMCopyCount: 50_000,
  }),
  profileFromTwin("MX-VA-002", {
    lastCleaningDate: "2026-06-22",
    lastPMCopyCount: 80_000,
    lastCleaningCopyCount: 80_000,
  }),
  profileFromTwin("MX-VA-003", {
    lastCleaningDate: "2026-05-30",
    lastJointUnitDate: "2026-04-20",
    lastPMCopyCount: 20_000,
    lastCleaningCopyCount: 20_000,
    lastJointUnitCopyCount: 20_000,
  }),
  profileFromTwin("MX-VA-004"),
  profileFromTwin("MX-T22-001", {
    lastCleaningDate: "2026-06-12",
    lastPMCopyCount: 10_000,
    lastCleaningCopyCount: 10_000,
  }),
  profileFromTwin("MX-T21-001", {
    currentCopyCount: null,
    previousCopyCount: null,
    monthlyVolume: null,
    lastPMDate: null,
    lastCleaningDate: null,
  }),
];

export const sampleCopyCountHistory: CopyCountHistory[] = [
  {
    id: "cch-001",
    printerId: "MX-GD-002",
    recordedAt: "2026-07-05T14:20:00.000Z",
    copyCount: 1_112_945,
    enteredBy: "Sam Ortiz",
    notes: "On-site meter read during Tray 2 service call (sample).",
    previousCount: 1_085_200,
    lowerCountReason: null,
  },
  {
    id: "cch-002",
    printerId: "MX-GD-002",
    recordedAt: "2026-06-01T10:00:00.000Z",
    copyCount: 1_085_200,
    enteredBy: "Jordan Hale",
    notes: "Monthly copy count entry (sample).",
    previousCount: 1_050_000,
    lowerCountReason: null,
  },
  {
    id: "cch-003",
    printerId: "MX-GL-001",
    recordedAt: "2026-07-04T09:30:00.000Z",
    copyCount: 642_110,
    enteredBy: "Riley Chen",
    notes: "Registration visit meter capture (sample).",
    previousCount: 620_000,
    lowerCountReason: null,
  },
  {
    id: "cch-004",
    printerId: "MX-VA-001",
    recordedAt: "2026-07-02T16:00:00.000Z",
    copyCount: 210_450,
    enteredBy: "Taylor Brooks",
    notes: "Post-cleaning count (sample).",
    previousCount: 200_000,
    lowerCountReason: null,
  },
  {
    id: "cch-005",
    printerId: "MX-GD-001",
    recordedAt: "2026-06-28T11:15:00.000Z",
    copyCount: 980_000,
    enteredBy: "PM Scheduler",
    notes: "Pre-PM window reading (sample).",
    previousCount: 950_000,
    lowerCountReason: null,
  },
];

export const sampleMaintenanceCompletions: MaintenanceCompletionRecord[] = [
  {
    id: "mch-001",
    printerId: "MX-GD-002",
    kind: "PM",
    completedAt: "2026-05-30T13:00:00.000Z",
    copyCountAtCompletion: 200_000,
    technician: "Sarah Chen",
    notes: "Quarterly PM kit installed (sample seed).",
    workPerformed: "PM kit + calibration",
  },
  {
    id: "mch-002",
    printerId: "MX-GD-002",
    kind: "CLEANING",
    completedAt: "2026-06-28T15:00:00.000Z",
    copyCountAtCompletion: 900_000,
    technician: "Sam Ortiz",
    notes: "Feed path cleaning (sample seed).",
    workPerformed: "Feed path and drum area cleaning",
  },
  {
    id: "mch-003",
    printerId: "MX-GD-002",
    kind: "JOINT_UNIT",
    completedAt: "2026-04-02T10:30:00.000Z",
    copyCountAtCompletion: 200_000,
    technician: "Riley Chen",
    notes: "Joint unit service (sample seed).",
    workPerformed: "Joint unit inspection/service",
  },
  {
    id: "mch-004",
    printerId: "MX-VA-001",
    kind: "DTF_PM",
    completedAt: "2026-06-18T12:00:00.000Z",
    copyCountAtCompletion: 50_000,
    technician: "Taylor Brooks",
    notes: "DTF PM (sample seed).",
    workPerformed: "DTF preventive maintenance",
  },
];

/** Seed timeline derived from real sample history (not disposable mock-only events). */
export const sampleMaintenanceTimeline: MaintenanceTimelineEvent[] = [
  {
    id: "mtl-001",
    printerId: "MX-GD-002",
    type: "COPY_COUNT_ENTERED",
    title: "Copy Count Entered",
    description: "Meter reading recorded at 1,112,945",
    occurredAt: "2026-07-05T14:20:00.000Z",
    actor: "Sam Ortiz",
    copyCount: 1_112_945,
  },
  {
    id: "mtl-002",
    printerId: "MX-GD-002",
    type: "CLEANING_COMPLETED",
    title: "Cleaning Completed",
    description: "Cleaning completed at 900,000 copies",
    occurredAt: "2026-06-28T15:00:00.000Z",
    actor: "Sam Ortiz",
    copyCount: 900_000,
  },
  {
    id: "mtl-003",
    printerId: "MX-GD-002",
    type: "PM_COMPLETED",
    title: "PM Completed",
    description: "PM completed at 200,000 copies",
    occurredAt: "2026-05-30T13:00:00.000Z",
    actor: "Sarah Chen",
    copyCount: 200_000,
  },
  {
    id: "mtl-004",
    printerId: "MX-GD-002",
    type: "JOINT_UNIT",
    title: "Joint Unit PM",
    description: "Joint Unit PM completed at 200,000 copies",
    occurredAt: "2026-04-02T10:30:00.000Z",
    actor: "Riley Chen",
    copyCount: 200_000,
  },
  {
    id: "mtl-005",
    printerId: "MX-VA-001",
    type: "DTF_PM",
    title: "DTF PM",
    description: "DTF PM completed at 50,000 copies",
    occurredAt: "2026-06-18T12:00:00.000Z",
    actor: "Taylor Brooks",
    copyCount: 50_000,
  },
  {
    id: "mtl-006",
    printerId: "MX-VA-001",
    type: "COPY_COUNT_ENTERED",
    title: "Copy Count Entered",
    description: "Meter reading recorded at 210,450",
    occurredAt: "2026-07-02T16:00:00.000Z",
    actor: "Taylor Brooks",
    copyCount: 210_450,
  },
  {
    id: "mtl-007",
    printerId: "MX-GL-001",
    type: "COPY_COUNT_ENTERED",
    title: "Copy Count Entered",
    description: "Meter reading recorded at 642,110",
    occurredAt: "2026-07-04T09:30:00.000Z",
    actor: "Riley Chen",
    copyCount: 642_110,
  },
];
