import type { OrderPartLine, OrderPriority, PrinterLink, RequestType } from "./types";

export const requestTypes: RequestType[] = [
  "Service Ticket",
  "PM Kit",
  "Stock Replenishment",
  "Emergency Order",
];

export const priorities: OrderPriority[] = [
  "Low",
  "Normal",
  "High",
  "Critical",
];

export const printerLinks: PrinterLink[] = [
  {
    assetId: "MX-GD-002",
    customer: "SFX / MPX",
    model: "GD9630",
    ticketNumber: "TKT-2026-0142",
    pmRequest: "PM-KIT-GD9630-2026-Q2",
  },
  {
    assetId: "MX-VA-002",
    customer: "SFX / MPX",
    model: "Valezus",
    ticketNumber: "TKT-2026-0138",
    pmRequest: "PM-KIT-VAL-2026-Q2",
  },
  {
    assetId: "MX-GL-001",
    customer: "SFX / MPX",
    model: "GL9730",
    ticketNumber: "TKT-2026-0135",
    pmRequest: "PM-KIT-GL9730-2026-Q2",
  },
];

export function createInitialOrderParts(): OrderPartLine[] {
  return [
    {
      id: "feed-rollers",
      partNumber: "RIS-GD-FR-2202",
      partName: "Feed Rollers",
      compatibleModel: "GD9630",
      currentStock: 2,
      quantityNeeded: 2,
      orderQuantity: 0,
    },
    {
      id: "separation-pads",
      partNumber: "RIS-GD-SP-1805",
      partName: "Separation Pads",
      compatibleModel: "GD9630",
      currentStock: 1,
      quantityNeeded: 3,
      orderQuantity: 2,
    },
    {
      id: "registration-rollers",
      partNumber: "RIS-GL-RR-3100",
      partName: "Registration Rollers",
      compatibleModel: "GL9730",
      currentStock: 3,
      quantityNeeded: 1,
      orderQuantity: 0,
    },
    {
      id: "sensors",
      partNumber: "RIS-GD-SN-4105",
      partName: "Sensors",
      compatibleModel: "GD9630",
      currentStock: 2,
      quantityNeeded: 1,
      orderQuantity: 0,
    },
    {
      id: "belts",
      partNumber: "RIS-GD-BT-6203",
      partName: "Belts",
      compatibleModel: "GD9630",
      currentStock: 3,
      quantityNeeded: 1,
      orderQuantity: 0,
    },
    {
      id: "cleaning-supplies",
      partNumber: "RIS-GD-CL-8801",
      partName: "Cleaning Supplies",
      compatibleModel: "GD9630 / GL9730",
      currentStock: 12,
      quantityNeeded: 2,
      orderQuantity: 0,
    },
  ];
}

export function getPartStatus(
  part: OrderPartLine,
): "In Stock" | "Low Stock" | "Order Required" {
  if (part.quantityNeeded <= 0) return "In Stock";
  if (part.currentStock >= part.quantityNeeded) return "In Stock";
  if (part.currentStock > 0) return "Low Stock";
  return "Order Required";
}

export function getOrderQuantity(part: OrderPartLine): number {
  if (part.orderQuantity > 0) return part.orderQuantity;
  const shortfall = part.quantityNeeded - part.currentStock;
  return shortfall > 0 ? shortfall : 0;
}
