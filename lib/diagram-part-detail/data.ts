import type { DiagramPartDetail, PartStatus } from "./types";

export const statusStyles: Record<PartStatus, string> = {
  "In Stock": "text-emerald-400",
  "Low Stock": "text-amber-400",
  "Order Required": "text-rose-400",
  Discontinued: "text-slate-500",
};

export const SAMPLE_DIAGRAM_PART_DETAIL: DiagramPartDetail = {
  partName: "Feed Tray Roller",
  partNumber: "RIS-GD-FU-1201",
  compatibleModel: "GD9630",
  assembly: "Feed Unit",
  calloutNumber: "12",
  status: "In Stock",
  diagramName: "GD9630 Feed Unit — Tray 1 & 2",
  description:
    "Primary feed roller for Tray 1. Drives paper from the cassette into the registration path. Replace when surface wear, flat spots, or feed slippage are observed during PM or service calls.",
  quantityNormallyRequired: 1,
  compatibleModels: ["GD9630", "GD9630HC"],
  relatedPmKit: "GD9630 Standard PM Kit — Feed / Transport",
  commonReplacementReason:
    "Wear from high-volume feed cycles, separation pad contact marks, or customer-reported misfeeds from Tray 1.",
  notes:
    "Inspect separation pad (callout 13) when replacing this roller. Verify tray lift mechanism before closing service ticket.",
  inventory: {
    currentStock: 4,
    reorderLevel: 2,
    onOrder: 6,
    needToOrderQuantity: 0,
  },
};
