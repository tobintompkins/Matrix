/**
 * Digital Twin machine profile types.
 *
 * Future live integrations (placeholders — not wired yet):
 * - Live RRA data
 * - Printer telemetry
 * - Real meter reporting
 * - Remote diagnostics
 * - Error log synchronization
 * - Customer database
 * - Service history database
 */

export type MachineStatus =
  | "ONLINE"
  | "OFFLINE"
  | "DEGRADED"
  | "SERVICE_REQUIRED"
  | "DOWN"
  | "INSTALLATION"
  | "RETIRED";

export type MachineHealthBand = "HEALTHY" | "WATCH" | "AT_RISK" | "CRITICAL";

export type MachineNetworkState =
  | "CONNECTED"
  | "INTERMITTENT"
  | "DISCONNECTED"
  | "UNKNOWN";

export type AlertSeverity = "info" | "warning" | "critical";

export type MachineIdentity = {
  machineId: string;
  assetTag: string;
  serialNumber: string;
  printerModel: string;
  nickname: string;
  manufacturer: string;
  installationDate: string;
};

export type MachineLocation = {
  customerName: string;
  siteName: string;
  building: string;
  department: string;
  floor: string;
  physicalLocation: string;
  shipToAddress: string;
  primaryContact: string;
  contactPhone: string;
  contactEmail: string;
  organization: "SFX" | "MPX" | "SFX / MPX" | string;
};

export type MachineAssignment = {
  assignedTechnician: string;
  assignedRegion: string;
  assignedOrganization: string;
  assignedWarehouse: string;
  assignedServiceTeam: string;
};

export type MachineOperationalStatus = {
  status: MachineStatus;
  currentMeterCount: number;
  monthlyVolume: number;
  lastReportedActivity: string;
  downtimeStatus: string;
};

export type MachineNetworkStatus = {
  networkStatus: MachineNetworkState;
  rraStatus: string;
  ipAddress: string;
  hostname: string;
  firmwareVersion: string;
  controllerVersion: string;
};

export type MachineServiceSummary = {
  lastServiceDate: string;
  lastPmDate: string;
  nextPmMeterTarget: number;
  currentPmMeterRemaining: number;
  openServiceCalls: number;
  recentErrorCodes: string[];
  downtimeStatus: string;
};

export type MachineConfiguration = {
  installedAccessories: string[];
  finishingOptions: string[];
  paperFeedConfiguration: string;
  outputConfiguration: string;
  controllerType: string;
  specialCustomerConfiguration: string;
  supportedPaperSizes: string[];
};

export type MachineInstalledPart = {
  partNumber: string;
  partName: string;
  installedDate: string;
  status: "Installed" | "Monitor" | "Replace Soon" | "Critical";
};

export type MachineAlert = {
  alertId: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  createdDate: string;
  resolved: boolean;
  type:
    | "machine-offline"
    | "pm-due-soon"
    | "pm-overdue"
    | "service-call-open"
    | "emergency-part-required"
    | "network-issue"
    | "rra-disconnected"
    | "high-error-frequency";
};

export type MachineHealthScore = {
  score: number;
  band: MachineHealthBand;
  factors: string[];
};

export type MachineNote = {
  id: string;
  author: string;
  createdAt: string;
  category: "technician" | "customer";
  text: string;
};

export type MachineAttachment = {
  id: string;
  label: string;
  category: "photo" | "manual" | "network" | "other";
  description: string;
};

export type MachinePartsInfo = {
  frequentlyUsedParts: MachineInstalledPart[];
  currentlyInstalled: MachineInstalledPart[];
  recentPartsReplaced: MachineInstalledPart[];
  openPartsOrders: number;
  emergencyPartsNeeds: string[];
  diagramShortcut: string;
};

export type DigitalTwinMachine = {
  identity: MachineIdentity;
  location: MachineLocation;
  assignment: MachineAssignment;
  operational: MachineOperationalStatus;
  network: MachineNetworkStatus;
  service: MachineServiceSummary;
  configuration: MachineConfiguration;
  parts: MachinePartsInfo;
  alerts: MachineAlert[];
  health: MachineHealthScore;
  notes: MachineNote[];
  attachments: MachineAttachment[];
  serviceHistory: Array<{
    id: string;
    date: string;
    type: string;
    summary: string;
    technician: string;
    status: string;
  }>;
};
