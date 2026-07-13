import type { PrinterDetail } from "./types";

const printers: Record<string, PrinterDetail> = {
  "mx-gd-002": {
    id: "mx-gd-002",
    model: "GD9630",
    serialNumber: "GD9630-2024-00842",
    assetNumber: "MX-GD-002",
    customer: "SFX / MPX",
    location: "SFX Chicago Production Floor",
    status: "PM Due",
    meters: {
      totalImpressions: 1112945,
      color: 0,
      black: 1112945,
      lastMeterRead: "2026-07-05",
    },
    pm: {
      lastPM: "2026-05-30",
      nextPMDue: "2026-07-15",
      pmKitInstalled: "PM-KIT-GD9630-2026-Q2",
    },
    components: [
      {
        name: "Feed Rollers",
        partNumber: "RIS-GD-FR-2202",
        lifeUsedPercent: 78,
        status: "Replace Soon",
        installedDate: "2026-02-14",
      },
      {
        name: "Registration Rollers",
        partNumber: "RIS-GD-RR-3105",
        lifeUsedPercent: 42,
        status: "Good",
        installedDate: "2025-11-08",
      },
      {
        name: "Sensors",
        partNumber: "RIS-GD-SN-4105",
        lifeUsedPercent: 15,
        status: "Good",
        installedDate: "2026-01-20",
      },
      {
        name: "Belts",
        partNumber: "RIS-GD-BT-6203",
        lifeUsedPercent: 61,
        status: "Monitor",
        installedDate: "2025-09-12",
      },
      {
        name: "Separation Pads",
        partNumber: "RIS-GD-SP-1805",
        lifeUsedPercent: 85,
        status: "Replace Soon",
        installedDate: "2026-03-02",
      },
    ],
    serviceHistory: [
      {
        id: "sh-001",
        date: "2026-07-05",
        summary: "Opened ticket for recurring Tray 2 jams during high-volume runs.",
        technician: "Mike Reynolds",
        type: "Repair",
      },
      {
        id: "sh-002",
        date: "2026-05-30",
        summary: "Quarterly PM completed — feed path cleaned, rollers inspected, calibration verified.",
        technician: "Sarah Chen",
        type: "PM",
      },
      {
        id: "sh-003",
        date: "2026-04-12",
        summary: "Replaced separation pad set on Tray 2 after edge marking complaints.",
        technician: "Mike Reynolds",
        type: "Parts",
      },
      {
        id: "sh-004",
        date: "2026-02-14",
        summary: "Installed new feed roller assembly on Tray 2.",
        technician: "Toby Tompkins",
        type: "Parts",
      },
      {
        id: "sh-005",
        date: "2026-01-08",
        summary: "Annual inspection — all systems within spec, minor belt wear noted.",
        technician: "Sarah Chen",
        type: "Inspection",
      },
    ],
    openTickets: [
      {
        ticketNumber: "TKT-2026-0142",
        issue: "GD9630 jamming from Tray 2",
        priority: "High",
        status: "Open",
        assignedTo: "Mike Reynolds",
        created: "2026-07-05",
      },
    ],
  },
  "mx-va-002": {
    id: "mx-va-002",
    model: "Valezus",
    serialNumber: "VAL-2023-01567",
    assetNumber: "MX-VA-002",
    customer: "SFX / MPX",
    location: "MPX Miami Creative Center",
    status: "Attention",
    meters: {
      totalImpressions: 312480,
      color: 198220,
      black: 114260,
      lastMeterRead: "2026-07-04",
    },
    pm: {
      lastPM: "2026-06-08",
      nextPMDue: "2026-08-08",
      pmKitInstalled: "PM-KIT-VAL-2026-Q2",
    },
    components: [
      {
        name: "Feed Rollers",
        partNumber: "RIS-VA-FR-2208",
        lifeUsedPercent: 35,
        status: "Good",
        installedDate: "2026-04-01",
      },
      {
        name: "Registration Rollers",
        partNumber: "RIS-VA-RR-3110",
        lifeUsedPercent: 52,
        status: "Monitor",
        installedDate: "2025-12-15",
      },
      {
        name: "Sensors",
        partNumber: "RIS-VA-SN-4112",
        lifeUsedPercent: 22,
        status: "Good",
        installedDate: "2026-02-28",
      },
      {
        name: "Belts",
        partNumber: "RIS-VA-BT-6201",
        lifeUsedPercent: 48,
        status: "Monitor",
        installedDate: "2025-10-20",
      },
      {
        name: "Separation Pads",
        partNumber: "RIS-VA-SP-4402",
        lifeUsedPercent: 67,
        status: "Monitor",
        installedDate: "2026-01-10",
      },
    ],
    serviceHistory: [
      {
        id: "sh-101",
        date: "2026-07-04",
        summary: "Investigating black marks on sheet edge — drum cleaning blade suspected.",
        technician: "Toby Tompkins",
        type: "Repair",
      },
      {
        id: "sh-102",
        date: "2026-06-08",
        summary: "Routine PM — color registration check and ink system flush.",
        technician: "Sarah Chen",
        type: "PM",
      },
      {
        id: "sh-103",
        date: "2026-04-01",
        summary: "Replaced feed roller assembly after bypass tray feed issues.",
        technician: "Mike Reynolds",
        type: "Parts",
      },
    ],
    openTickets: [
      {
        ticketNumber: "TKT-2026-0138",
        issue: "Valezus black marks on sheet edge",
        priority: "High",
        status: "In Progress",
        assignedTo: "Toby Tompkins",
        created: "2026-07-04",
      },
    ],
  },
  "mx-gl-001": {
    id: "mx-gl-001",
    model: "GL9730",
    serialNumber: "GL9730-2024-00321",
    assetNumber: "MX-GL-001",
    customer: "SFX / MPX",
    location: "MPX Los Angeles Plant",
    status: "Online",
    meters: {
      totalImpressions: 654870,
      color: 412300,
      black: 242570,
      lastMeterRead: "2026-07-03",
    },
    pm: {
      lastPM: "2026-06-27",
      nextPMDue: "2026-09-27",
      pmKitInstalled: "PM-KIT-GL9730-2026-Q2",
    },
    components: [
      {
        name: "Feed Rollers",
        partNumber: "RIS-GL-FR-2210",
        lifeUsedPercent: 28,
        status: "Good",
        installedDate: "2026-03-18",
      },
      {
        name: "Registration Rollers",
        partNumber: "RIS-GL-RR-3100",
        lifeUsedPercent: 55,
        status: "Monitor",
        installedDate: "2025-11-22",
      },
      {
        name: "Sensors",
        partNumber: "RIS-GL-SN-4102",
        lifeUsedPercent: 18,
        status: "Good",
        installedDate: "2026-01-05",
      },
      {
        name: "Belts",
        partNumber: "RIS-GL-BT-6210",
        lifeUsedPercent: 44,
        status: "Good",
        installedDate: "2025-08-30",
      },
      {
        name: "Separation Pads",
        partNumber: "RIS-GL-SP-1900",
        lifeUsedPercent: 38,
        status: "Good",
        installedDate: "2026-02-10",
      },
    ],
    serviceHistory: [
      {
        id: "sh-201",
        date: "2026-07-03",
        summary: "Opened ticket for duplex registration alignment drift.",
        technician: "Sarah Chen",
        type: "Repair",
      },
      {
        id: "sh-202",
        date: "2026-06-27",
        summary: "Quarterly PM — registration calibration and color profile update.",
        technician: "Mike Reynolds",
        type: "PM",
      },
      {
        id: "sh-203",
        date: "2026-03-18",
        summary: "Replaced pickup feed roller on large capacity tray.",
        technician: "Sarah Chen",
        type: "Parts",
      },
    ],
    openTickets: [
      {
        ticketNumber: "TKT-2026-0135",
        issue: "GL9730 registration alignment issue: image shift on duplex",
        priority: "Medium",
        status: "Open",
        assignedTo: "Sarah Chen",
        created: "2026-07-03",
      },
    ],
  },
};

const fleetDefaults: Record<
  string,
  Pick<PrinterDetail, "model" | "assetNumber" | "location" | "status" | "meters">
> = {
  "mx-gd-001": {
    model: "GD9630",
    assetNumber: "MX-GD-001",
    location: "SFX Chicago Print Room",
    status: "Online",
    meters: {
      totalImpressions: 1284320,
      color: 0,
      black: 1284320,
      lastMeterRead: "2026-07-05",
    },
  },
  "mx-gd-003": {
    model: "GD9630",
    assetNumber: "MX-GD-003",
    location: "MPX New York Mail Center",
    status: "Online",
    meters: {
      totalImpressions: 987410,
      color: 0,
      black: 987410,
      lastMeterRead: "2026-07-04",
    },
  },
  "mx-gd-004": {
    model: "GD9630",
    assetNumber: "MX-GD-004",
    location: "MPX New Jersey Operations",
    status: "Attention",
    meters: {
      totalImpressions: 1356070,
      color: 0,
      black: 1356070,
      lastMeterRead: "2026-07-02",
    },
  },
  "mx-gd-005": {
    model: "GD9630",
    assetNumber: "MX-GD-005",
    location: "SFX Dallas Fulfillment",
    status: "Online",
    meters: {
      totalImpressions: 864255,
      color: 0,
      black: 864255,
      lastMeterRead: "2026-07-05",
    },
  },
  "mx-gd-006": {
    model: "GD9630",
    assetNumber: "MX-GD-006",
    location: "MPX Atlanta Production",
    status: "In Service",
    meters: {
      totalImpressions: 1041630,
      color: 0,
      black: 1041630,
      lastMeterRead: "2026-07-02",
    },
  },
  "mx-gd-007": {
    model: "GD9630",
    assetNumber: "MX-GD-007",
    location: "SFX Phoenix Distribution",
    status: "Online",
    meters: {
      totalImpressions: 776540,
      color: 0,
      black: 776540,
      lastMeterRead: "2026-07-01",
    },
  },
  "mx-va-001": {
    model: "Valezus",
    assetNumber: "MX-VA-001",
    location: "SFX Chicago Design Studio",
    status: "Online",
    meters: {
      totalImpressions: 238910,
      color: 152400,
      black: 86510,
      lastMeterRead: "2026-07-04",
    },
  },
  "mx-va-003": {
    model: "Valezus",
    assetNumber: "MX-VA-003",
    location: "SFX Seattle Graphics Lab",
    status: "PM Due",
    meters: {
      totalImpressions: 287650,
      color: 180320,
      black: 107330,
      lastMeterRead: "2026-07-03",
    },
  },
  "mx-va-004": {
    model: "Valezus",
    assetNumber: "MX-VA-004",
    location: "MPX Boston Innovation Hub",
    status: "Online",
    meters: {
      totalImpressions: 194220,
      color: 121800,
      black: 72420,
      lastMeterRead: "2026-07-05",
    },
  },
};

function buildDefaultPrinter(id: string): PrinterDetail | null {
  const defaults = fleetDefaults[id];
  if (!defaults) return null;

  const serialPrefix =
    defaults.model === "GD9630"
      ? "GD9630"
      : defaults.model === "GL9730"
        ? "GL9730"
        : "VAL";

  return {
    id,
    model: defaults.model,
    serialNumber: `${serialPrefix}-2024-${id.slice(-3).toUpperCase()}`,
    assetNumber: defaults.assetNumber,
    customer: "SFX / MPX",
    location: defaults.location,
    status: defaults.status,
    meters: defaults.meters,
    pm: {
      lastPM: "2026-06-15",
      nextPMDue: "2026-09-15",
      pmKitInstalled: `PM-KIT-${defaults.model}-2026-Q2`,
    },
    components: [
      {
        name: "Feed Rollers",
        partNumber: `RIS-${defaults.model.slice(0, 2).toUpperCase()}-FR-2200`,
        lifeUsedPercent: 40,
        status: "Good",
        installedDate: "2026-01-15",
      },
      {
        name: "Registration Rollers",
        partNumber: `RIS-${defaults.model.slice(0, 2).toUpperCase()}-RR-3100`,
        lifeUsedPercent: 35,
        status: "Good",
        installedDate: "2025-12-01",
      },
      {
        name: "Sensors",
        partNumber: `RIS-${defaults.model.slice(0, 2).toUpperCase()}-SN-4100`,
        lifeUsedPercent: 20,
        status: "Good",
        installedDate: "2026-02-01",
      },
      {
        name: "Belts",
        partNumber: `RIS-${defaults.model.slice(0, 2).toUpperCase()}-BT-6200`,
        lifeUsedPercent: 50,
        status: "Monitor",
        installedDate: "2025-10-01",
      },
      {
        name: "Separation Pads",
        partNumber: `RIS-${defaults.model.slice(0, 2).toUpperCase()}-SP-1800`,
        lifeUsedPercent: 45,
        status: "Good",
        installedDate: "2026-03-01",
      },
    ],
    serviceHistory: [
      {
        id: `${id}-sh-1`,
        date: "2026-06-15",
        summary: "Routine PM completed — all systems within specification.",
        technician: "Mike Reynolds",
        type: "PM",
      },
      {
        id: `${id}-sh-2`,
        date: "2026-03-20",
        summary: "Annual inspection — no issues found.",
        technician: "Sarah Chen",
        type: "Inspection",
      },
    ],
    openTickets: [],
  };
}

export function getAllPrinterIds(): string[] {
  return [...Object.keys(printers), ...Object.keys(fleetDefaults)];
}

export function getPrinterById(id: string): PrinterDetail | null {
  const normalizedId = id.toLowerCase();
  return printers[normalizedId] ?? buildDefaultPrinter(normalizedId);
}

export { printers };
