export type PrinterComponent = {
  name: string;
  partNumber: string;
  lifeUsedPercent: number;
  status: "Good" | "Monitor" | "Replace Soon" | "Critical";
  installedDate: string;
};

export type ServiceHistoryEntry = {
  id: string;
  date: string;
  summary: string;
  technician: string;
  type: "Repair" | "PM" | "Inspection" | "Parts";
};

export type OpenTicket = {
  ticketNumber: string;
  issue: string;
  priority: "High" | "Medium" | "Low";
  status: string;
  assignedTo: string;
  created: string;
};

export type PrinterMeters = {
  totalImpressions: number;
  color: number;
  black: number;
  lastMeterRead: string;
};

export type PrinterPM = {
  lastPM: string;
  nextPMDue: string;
  pmKitInstalled: string;
};

/** Patch 33 — nullable copy/PM foundation fields (UI uses lib/maintenance). */
export type PrinterCopyCountFields = {
  currentCopyCount: number | null;
  previousCopyCount: number | null;
  monthlyVolume: number | null;
  lastPMDate: string | null;
  lastCleaningDate: string | null;
  lastJointUnitDate: string | null;
  lastDTFPMDate: string | null;
  nextPMDue: string | null;
  nextCleaningDue: string | null;
  nextJointUnitDue: string | null;
  nextDTFDue: string | null;
};

export type PrinterDetail = {
  id: string;
  model: string;
  serialNumber: string;
  assetNumber: string;
  customer: string;
  location: string;
  status: string;
  meters: PrinterMeters;
  pm: PrinterPM;
  /** Optional foundation fields — prefer lib/maintenance profiles when present */
  copyCount?: PrinterCopyCountFields;
  components: PrinterComponent[];
  serviceHistory: ServiceHistoryEntry[];
  openTickets: OpenTicket[];
};
