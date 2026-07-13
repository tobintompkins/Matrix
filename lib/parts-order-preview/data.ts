import type { PartsOrderPreview } from "./types";

export const SAMPLE_PARTS_ORDER_PREVIEW: PartsOrderPreview = {
  requesterName: "Toby Tompkins",
  requestDate: "2026-07-08",
  poNumber: "PO-2026-0847",
  customerServiceCall: "SFX / MPX — TCK-1001",
  shipToAddress:
    "SFX Chicago Production Floor\n1200 Industrial Parkway\nChicago, IL 60607",
  shippingMethod: "Next Day Air",
  priority: "High",
  specialInstructions:
    "Deliver to technician van before Friday dispatch. Contact site manager on arrival.",
  printerModel: "GD9630",
  serialNumber: "GD9630-SN-001",
  assetId: "GD-9630-001",
  location: "SFX Chicago Production Floor",
  relatedTicket: "TCK-1001",
  lines: [
    {
      itemNumber: 1,
      partNumber: "RIS-GD-FU-1202",
      description: "Separation Pad Assembly — Tray 2",
      quantity: 2,
      reason: "Worn during Tray 2 service call",
      source: "Diagram",
    },
    {
      itemNumber: 2,
      partNumber: "RIS-GD-SN-3101",
      description: "Paper Path Sensor",
      quantity: 1,
      reason: "Fault code E-2041",
      source: "Diagram",
    },
    {
      itemNumber: 3,
      partNumber: "RIS-GD-TR-5102",
      description: "Timing Pulley",
      quantity: 1,
      reason: "Broken during transport repair",
      source: "Manual Entry",
    },
    {
      itemNumber: 4,
      partNumber: "RIS-GD-SP-1805",
      description: "Separation Pad Set (Tray 1–3)",
      quantity: 1,
      reason: "PM kit replenishment",
      source: "PM Kit",
    },
    {
      itemNumber: 5,
      partNumber: "RIS-GD-FR-2202",
      description: "Feed Roller Assembly — Tray 2",
      quantity: 2,
      reason: "Below reorder level — warehouse restock",
      source: "Inventory Reorder",
    },
  ],
  technicianSignature: "Pending capture",
  managerApproval: "Pending approval",
  warehouseReview: "Pending review",
  dateSubmitted: "2026-07-08",
};

export const sourceStyles: Record<
  PartsOrderPreview["lines"][number]["source"],
  string
> = {
  "PM Kit": "bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/30",
  Diagram: "bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/30",
  "Manual Entry": "bg-slate-500/15 text-slate-300 ring-1 ring-slate-500/30",
  "Inventory Reorder":
    "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30",
};

export const priorityStyles: Record<
  PartsOrderPreview["priority"],
  string
> = {
  Low: "text-slate-400",
  Normal: "text-cyan-400",
  High: "text-amber-400",
  Critical: "text-rose-400",
};
