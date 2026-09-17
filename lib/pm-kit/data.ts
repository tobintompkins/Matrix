import {initialEquipment} from '../equipment/catalog';
import type { PMPartLine, PMType, PrinterOption } from "./types";

export const pmTypes: PMType[] = [
  "Standard PM Clean",
  "Full PM Kit",
  "Feed System PM",
  "Registration / Alignment PM",
];

export const printerOptions:PrinterOption[]=initialEquipment.filter(p=>!p.removed).map(p=>({assetId:p.id,customer:'SFX/MPX',model:p.model,serialNumber:p.serialNumber,meterCount:NaN}));

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
