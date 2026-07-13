export type PrinterModel = "GD9630" | "GL9730" | "Valezus";

export type AssemblySection =
  | "Feed Unit"
  | "Registration"
  | "Sensors"
  | "Rollers"
  | "Transport"
  | "Exit Area";

export type OrderPriority = "Low" | "Normal" | "High" | "Critical";

export type ShippingMethod =
  | "Standard Ground"
  | "Next Day Air"
  | "Will Call"
  | "Technician Van";

export type DiagramCallout = {
  calloutNumber: string;
  partNumber: string;
  partName: string;
  inStock: number;
  reorderLevel: number;
};

export type SelectedPartLine = {
  id: string;
  calloutNumber: string;
  partNumber: string;
  description: string;
  quantityNeeded: number;
  inStock: number;
  orderQuantity: number;
  reason: string;
};

export type StockStatus = "available" | "low" | "needs-order";
