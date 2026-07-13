import type {
  DiagramCategory,
  DiagramRecord,
  PartCategory,
  PartImageRecord,
  PrinterModel,
} from "./types";

export const printerModels: Exclude<PrinterModel, "All">[] = [
  "GD9630",
  "GL9730",
  "Valezus",
];

export const diagramCategories: DiagramCategory[] = [
  "Feed Unit",
  "Registration",
  "Sensors",
  "Rollers",
  "Transport",
  "Exit Area",
  "Ink / Supply",
  "Duplex / Paper Path",
  "Covers / Panels",
  "Electrical",
];

export const partCategories: PartCategory[] = [
  "All",
  "Feed / Transport",
  "Sensors",
  "Consumables",
  "Electrical",
  "Covers",
];

export const diagramRecords: DiagramRecord[] = [
  {
    id: "dg-001",
    name: "GD9630 Feed Unit — Tray 1 & 2",
    model: "GD9630",
    assembly: "Feed Unit",
    calloutCount: 18,
    lastUpdated: "2026-06-12",
  },
  {
    id: "dg-002",
    name: "GD9630 Registration Assembly",
    model: "GD9630",
    assembly: "Registration",
    calloutCount: 14,
    lastUpdated: "2026-05-28",
  },
  {
    id: "dg-003",
    name: "GD9630 Paper Path Sensors",
    model: "GD9630",
    assembly: "Sensors",
    calloutCount: 11,
    lastUpdated: "2026-06-01",
  },
  {
    id: "dg-004",
    name: "GD9630 Transport Rollers",
    model: "GD9630",
    assembly: "Rollers",
    calloutCount: 16,
    lastUpdated: "2026-04-15",
  },
  {
    id: "dg-005",
    name: "GD9630 Duplex / Paper Path",
    model: "GD9630",
    assembly: "Duplex / Paper Path",
    calloutCount: 12,
    lastUpdated: "2026-03-20",
  },
  {
    id: "dg-006",
    name: "GL9730 Feed Unit — LCT",
    model: "GL9730",
    assembly: "Feed Unit",
    calloutCount: 15,
    lastUpdated: "2026-06-08",
  },
  {
    id: "dg-007",
    name: "GL9730 Fuser / Exit Area",
    model: "GL9730",
    assembly: "Exit Area",
    calloutCount: 13,
    lastUpdated: "2026-05-14",
  },
  {
    id: "dg-008",
    name: "GL9730 Electrical — Main Board",
    model: "GL9730",
    assembly: "Electrical",
    calloutCount: 22,
    lastUpdated: "2026-02-10",
  },
  {
    id: "dg-009",
    name: "Valezus Ink / Supply System",
    model: "Valezus",
    assembly: "Ink / Supply",
    calloutCount: 10,
    lastUpdated: "2026-06-18",
  },
  {
    id: "dg-010",
    name: "Valezus Covers / Panels",
    model: "Valezus",
    assembly: "Covers / Panels",
    calloutCount: 8,
    lastUpdated: "2026-01-22",
  },
];

export const partImageRecords: PartImageRecord[] = [
  {
    id: "pi-001",
    partName: "Feed Tray Roller",
    partNumber: "RIS-GD-FU-1201",
    compatibleModel: "GD9630",
    category: "Feed / Transport",
  },
  {
    id: "pi-002",
    partName: "Separation Pad Assembly",
    partNumber: "RIS-GD-FU-1202",
    compatibleModel: "GD9630",
    category: "Feed / Transport",
  },
  {
    id: "pi-003",
    partName: "Paper Path Sensor",
    partNumber: "RIS-GD-SN-3101",
    compatibleModel: "GD9630",
    category: "Sensors",
  },
  {
    id: "pi-004",
    partName: "Ink Supply Unit",
    partNumber: "RIS-GD-INK-7101",
    compatibleModel: "GD9630",
    category: "Consumables",
  },
  {
    id: "pi-005",
    partName: "Feed Clutch Assembly",
    partNumber: "RIS-GL-FU-1101",
    compatibleModel: "GL9730",
    category: "Feed / Transport",
  },
  {
    id: "pi-006",
    partName: "Registration Sensor Board",
    partNumber: "RIS-GL-RR-2101",
    compatibleModel: "GL9730",
    category: "Sensors",
  },
  {
    id: "pi-007",
    partName: "Main Control PCB",
    partNumber: "RIS-GL-EL-9001",
    compatibleModel: "GL9730",
    category: "Electrical",
  },
  {
    id: "pi-008",
    partName: "CMYK Ink Set",
    partNumber: "RIS-VA-INK-7001",
    compatibleModel: "Valezus",
    category: "Consumables",
  },
  {
    id: "pi-009",
    partName: "Front Cover Panel",
    partNumber: "RIS-VA-CV-8001",
    compatibleModel: "Valezus",
    category: "Covers",
  },
  {
    id: "pi-010",
    partName: "Transport Roller Set",
    partNumber: "RIS-GD-RL-4101",
    compatibleModel: "GD9630",
    category: "Feed / Transport",
  },
];

export const modelCounts: Record<Exclude<PrinterModel, "All">, number> = {
  GD9630: diagramRecords.filter((d) => d.model === "GD9630").length,
  GL9730: diagramRecords.filter((d) => d.model === "GL9730").length,
  Valezus: diagramRecords.filter((d) => d.model === "Valezus").length,
};
