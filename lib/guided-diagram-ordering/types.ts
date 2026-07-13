export type PrinterModel = "GD9630" | "GL9730" | "Valezus";

export type AssemblySection =
  | "Feed Unit"
  | "Registration"
  | "Sensors"
  | "Rollers"
  | "Transport"
  | "Exit Area"
  | "Ink / Supply"
  | "Duplex / Paper Path";

export type OrderPriority = "Low" | "Normal" | "High" | "Critical";

export type InventoryStatus = "In Stock" | "Low Stock" | "Order Required";

export type DiagramCalloutRow = {
  calloutNumber: string;
  partNumber: string;
  partName: string;
  description: string;
  quantity: number;
  compatibleModel: string;
  inStock: number;
  inventoryStatus: InventoryStatus;
};

export type CartLine = {
  id: string;
  calloutNumber: string;
  partNumber: string;
  partName: string;
  quantityNeeded: number;
  inStock: number;
  orderQuantity: number;
  reason: string;
};
