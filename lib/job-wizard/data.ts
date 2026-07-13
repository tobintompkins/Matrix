import type { ChecklistItem, JobType, WizardPrinter } from "./types";

export const jobTypes: JobType[] = [
  "Break/Fix",
  "Preventive Maintenance",
  "Installation",
  "Training",
  "Relocation",
  "Warranty Repair",
  "Network Issue",
  "Firmware Update",
];

export const laborEstimates: Record<JobType, string> = {
  "Break/Fix": "1.5 – 3 hours",
  "Preventive Maintenance": "2 – 4 hours",
  Installation: "4 – 8 hours",
  Training: "1 – 2 hours",
  Relocation: "6 – 10 hours",
  "Warranty Repair": "2 – 5 hours",
  "Network Issue": "1 – 2 hours",
  "Firmware Update": "0.5 – 1 hour",
};

export const technicians = [
  "Toby Tompkins",
  "Mike Reynolds",
  "Sarah Chen",
];

export const printerOptions: WizardPrinter[] = [
  {
    assetId: "MX-GD-002",
    customer: "SFX / MPX",
    model: "GD9630",
    serialNumber: "GD9630-2024-00842",
    meterCount: 1112945,
    location: "SFX Chicago Production Floor",
  },
  {
    assetId: "MX-VA-002",
    customer: "SFX / MPX",
    model: "Valezus",
    serialNumber: "VAL-2023-01567",
    meterCount: 312480,
    location: "MPX Miami Creative Center",
  },
  {
    assetId: "MX-GL-001",
    customer: "SFX / MPX",
    model: "GL9730",
    serialNumber: "GL9730-2024-00321",
    meterCount: 654870,
    location: "MPX Los Angeles Plant",
  },
];

export const pmChecklistTemplate: Omit<ChecklistItem, "completed">[] = [
  { id: "feed-rollers", label: "Inspect feed rollers" },
  { id: "separation-pads", label: "Inspect separation pads" },
  { id: "sensors", label: "Clean sensors" },
  { id: "registration", label: "Check registration area" },
  { id: "belts", label: "Inspect belts" },
  { id: "paper-path", label: "Clean paper path" },
  { id: "waste", label: "Check waste components" },
  { id: "test-prints", label: "Run test prints" },
  { id: "meter", label: "Record meter count" },
];

export const pmPartsInStock = [
  "Feed Rollers (8 on hand)",
  "Registration Rollers (3 on hand)",
  "Sensors (5 on hand)",
  "Belts (4 on hand)",
  "Cleaning Supplies (12 on hand)",
];

export const pmPartsNeedingOrder = [
  "Separation Pads (1 on hand, 3 needed)",
  "Waste Components (out of stock)",
];

export function createInitialChecklist(): ChecklistItem[] {
  return pmChecklistTemplate.map((item) => ({
    ...item,
    completed: false,
  }));
}
