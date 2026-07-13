import type {
  ContextPrinter,
  IssueCategory,
  RelatedItem,
  SuggestedCheck,
} from "./types";

export const issueCategories: IssueCategory[] = [
  "Paper Jam",
  "Feed Issue",
  "Image Quality",
  "Registration",
  "Network",
  "Ink / Supply",
  "Sensor",
  "Preventive Maintenance",
];

export const contextPrinters: ContextPrinter[] = [
  {
    assetId: "MX-GD-002",
    customer: "SFX / MPX",
    model: "GD9630",
    serialNumber: "GD9630-2024-00842",
    meterCount: 1112945,
    errorCode: "P-021 / Tray 2 Jam",
  },
  {
    assetId: "MX-VA-002",
    customer: "SFX / MPX",
    model: "Valezus",
    serialNumber: "VAL-2023-01567",
    meterCount: 312480,
    errorCode: "IQ-014 / Edge Marking",
  },
  {
    assetId: "MX-GL-001",
    customer: "SFX / MPX",
    model: "GL9730",
    serialNumber: "GL9730-2024-00321",
    meterCount: 654870,
    errorCode: "R-008 / Duplex Shift",
  },
];

export const suggestedChecksTemplate: Omit<SuggestedCheck, "completed">[] = [
  { id: "feed-rollers", label: "Inspect feed rollers" },
  { id: "separation-pads", label: "Check separation pads" },
  { id: "paper-path-sensors", label: "Clean paper path sensors" },
  { id: "registration", label: "Inspect registration area" },
  { id: "tray-guides", label: "Verify tray guides" },
  { id: "test-prints", label: "Run test prints" },
];

export function createSuggestedChecks(): SuggestedCheck[] {
  return suggestedChecksTemplate.map((check) => ({
    ...check,
    completed: false,
  }));
}

export const relatedTickets: RelatedItem[] = [
  {
    id: "tkt-142",
    title: "TKT-2026-0142",
    detail: "GD9630 Tray 2 jam — Open",
  },
  {
    id: "tkt-138",
    title: "TKT-2026-0138",
    detail: "Valezus black marks — In Progress",
  },
];

export const relatedServiceHistory: RelatedItem[] = [
  {
    id: "svc-1",
    title: "2026-05-30",
    detail: "Quarterly PM — feed path cleaned",
  },
  {
    id: "svc-2",
    title: "2026-04-12",
    detail: "Replaced Tray 2 separation pads",
  },
];

export const relatedPartsReplaced: RelatedItem[] = [
  {
    id: "part-1",
    title: "RIS-GD-FR-2202",
    detail: "Feed Roller Assembly — Tray 2",
  },
  {
    id: "part-2",
    title: "RIS-GD-SP-1805",
    detail: "Separation Pad Set",
  },
];

export const relatedPmHistory: RelatedItem[] = [
  {
    id: "pm-1",
    title: "PM-KIT-GD9630-2026-Q2",
    detail: "Completed 2026-05-30",
  },
  {
    id: "pm-2",
    title: "Next PM Due",
    detail: "2026-07-15",
  },
];

export const relatedInventory: RelatedItem[] = [
  {
    id: "inv-1",
    title: "Feed Rollers",
    detail: "8 in stock — Warehouse A-12",
  },
  {
    id: "inv-2",
    title: "Separation Pads",
    detail: "1 in stock — Low / order needed",
  },
];
