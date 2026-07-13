import type { PMPartLine, PMType, PrinterOption } from "./types";

export const pmTypes: PMType[] = [
  "Standard PM Clean",
  "Full PM Kit",
  "Feed System PM",
  "Registration / Alignment PM",
];

export const printerOptions: PrinterOption[] = [
  {
    assetId: "MX-GD-002",
    customer: "SFX / MPX",
    model: "GD9630",
    serialNumber: "GD9630-2024-00842",
    meterCount: 1112945,
  },
  {
    assetId: "MX-VA-002",
    customer: "SFX / MPX",
    model: "Valezus",
    serialNumber: "VAL-2023-01567",
    meterCount: 312480,
  },
  {
    assetId: "MX-GL-001",
    customer: "SFX / MPX",
    model: "GL9730",
    serialNumber: "GL9730-2024-00321",
    meterCount: 654870,
  },
];

export const pmPartCatalog: PMPartLine[] = [
  {
    id: "feed-rollers",
    name: "Feed Rollers",
    inStock: true,
    stockQty: 8,
    defaultQty: 2,
  },
  {
    id: "separation-pads",
    name: "Separation Pads",
    inStock: false,
    stockQty: 0,
    defaultQty: 3,
  },
  {
    id: "registration-rollers",
    name: "Registration Rollers",
    inStock: true,
    stockQty: 3,
    defaultQty: 1,
  },
  {
    id: "sensors",
    name: "Sensors",
    inStock: true,
    stockQty: 5,
    defaultQty: 1,
  },
  {
    id: "belts",
    name: "Belts",
    inStock: true,
    stockQty: 4,
    defaultQty: 1,
  },
  {
    id: "cleaning-supplies",
    name: "Cleaning Supplies",
    inStock: true,
    stockQty: 12,
    defaultQty: 1,
  },
  {
    id: "waste-components",
    name: "Waste Components",
    inStock: false,
    stockQty: 0,
    defaultQty: 1,
  },
  {
    id: "misc-hardware",
    name: "Misc Hardware",
    inStock: true,
    stockQty: 6,
    defaultQty: 1,
  },
];

export function createInitialPartRequests(): import("./types").PMPartRequest[] {
  return pmPartCatalog.map((part) => ({
    id: part.id,
    name: part.name,
    inStock: part.inStock,
    stockQty: part.stockQty,
    needed:
      part.id === "feed-rollers" ||
      part.id === "separation-pads" ||
      part.id === "cleaning-supplies",
    quantity: part.defaultQty,
    notes: "",
  }));
}
