export type JobType =
  | "Break/Fix"
  | "Preventive Maintenance"
  | "Installation"
  | "Training"
  | "Relocation"
  | "Warranty Repair"
  | "Network Issue"
  | "Firmware Update";

export type ChecklistItem = {
  id: string;
  label: string;
  completed: boolean;
};

export type WizardPrinter = {
  assetId: string;
  customer: string;
  model: string;
  serialNumber: string;
  meterCount: number;
  location: string;
};
