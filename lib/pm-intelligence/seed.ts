import type {
  CleaningIntervalRule,
  PmIntervalRule,
  PmPartsKit,
  PmSettings,
} from "./types";
import { DEFAULT_PM_SETTINGS } from "./types";

export const PM_INTERVAL_RULES: PmIntervalRule[] = [
  {
    id: "rule-gd9630",
    name: "GD9630 Standard PM",
    printerModel: "GD9630",
    maintenanceType: "Standard PM",
    startingMeter: 0,
    intervalCount: 1_000_000,
    warningThreshold: 75_000,
    criticalThreshold: 25_000,
    graceThreshold: 10_000,
    dateBasedIntervalDays: null,
    requiredPartsKitId: "kit-gd9630-pm",
    estimatedLaborHours: 2.5,
    instructions: "Perform standard PM kit replacement and path cleaning.",
    active: true,
  },
  {
    id: "rule-gl9730",
    name: "GL9730 Standard PM",
    printerModel: "GL9730",
    maintenanceType: "Standard PM",
    startingMeter: 0,
    intervalCount: 1_000_000,
    warningThreshold: 75_000,
    criticalThreshold: 25_000,
    graceThreshold: 10_000,
    dateBasedIntervalDays: null,
    requiredPartsKitId: "kit-gl9730-pm",
    estimatedLaborHours: 2.5,
    instructions: "Standard GL PM with drum path inspection.",
    active: true,
  },
  {
    id: "rule-t2200",
    name: "T2200 Standard PM",
    printerModel: "T2200",
    maintenanceType: "Standard PM",
    startingMeter: 0,
    intervalCount: 500_000,
    warningThreshold: 75_000,
    criticalThreshold: 25_000,
    graceThreshold: 10_000,
    dateBasedIntervalDays: null,
    requiredPartsKitId: "kit-t2200-pm",
    estimatedLaborHours: 3,
    instructions: "T2200 PM every 500,000 impressions.",
    active: true,
  },
  {
    id: "rule-t2100",
    name: "T2100 Standard PM",
    printerModel: "T2100",
    maintenanceType: "Standard PM",
    startingMeter: 0,
    intervalCount: 500_000,
    warningThreshold: 75_000,
    criticalThreshold: 25_000,
    graceThreshold: 10_000,
    dateBasedIntervalDays: null,
    requiredPartsKitId: "kit-t2100-pm",
    estimatedLaborHours: 2.5,
    instructions: "T2100 PM every 500,000 impressions.",
    active: true,
  },
];

export const CLEANING_INTERVAL_RULES: CleaningIntervalRule[] = [
  {
    id: "cl-dtf",
    cleaningType: "DTF",
    label: "DTF Cleaning",
    printerModel: null,
    impressionInterval: 1_000_000,
    calendarIntervalDays: null,
    operatingHoursInterval: null,
    warningThreshold: 100_000,
    active: true,
  },
  {
    id: "cl-joint",
    cleaningType: "JOINT_UNIT",
    label: "Joint Unit Cleaning",
    printerModel: null,
    impressionInterval: 1_000_000,
    calendarIntervalDays: null,
    operatingHoursInterval: null,
    warningThreshold: 100_000,
    active: true,
  },
  {
    id: "cl-general",
    cleaningType: "GENERAL",
    label: "General Preventive Cleaning",
    printerModel: null,
    impressionInterval: 250_000,
    calendarIntervalDays: 90,
    operatingHoursInterval: null,
    warningThreshold: 50_000,
    active: true,
  },
];

export const PM_PARTS_KITS: PmPartsKit[] = [
  {
    id: "kit-gd9630-pm",
    name: "GD9630 PM Kit",
    printerModel: "GD9630",
    requiredParts: [
      { partNumber: "014-12345", description: "Master Roll Assembly", quantity: 1 },
      { partNumber: "FILTER-KIT-01", description: "Filter Kit", quantity: 1 },
    ],
    recommendedParts: [
      { partNumber: "014-55110", description: "Pressure Roller", quantity: 1 },
    ],
    consumables: [
      { partNumber: "S-8224", description: "Cleaning Cloth Pack", quantity: 1 },
    ],
    estimatedLaborHours: 2.5,
  },
  {
    id: "kit-t2200-pm",
    name: "T2200 PM Kit",
    printerModel: "T2200",
    requiredParts: [
      { partNumber: "014-67890", description: "Ink Drum Unit", quantity: 1 },
    ],
    recommendedParts: [],
    consumables: [{ partNumber: "FILTER-KIT-01", description: "Filter Kit", quantity: 1 }],
    estimatedLaborHours: 3,
  },
  {
    id: "kit-gl9730-pm",
    name: "GL9730 PM Kit",
    printerModel: "GL9730",
    requiredParts: [
      { partNumber: "014-12345", description: "Master Roll Assembly", quantity: 1 },
    ],
    recommendedParts: [],
    consumables: [],
    estimatedLaborHours: 2.5,
  },
  {
    id: "kit-t2100-pm",
    name: "T2100 PM Kit",
    printerModel: "T2100",
    requiredParts: [
      { partNumber: "014-67890", description: "Ink Drum Unit", quantity: 1 },
    ],
    recommendedParts: [],
    consumables: [],
    estimatedLaborHours: 2.5,
  },
];

export function defaultPmSettings(): PmSettings {
  return structuredClone(DEFAULT_PM_SETTINGS);
}
