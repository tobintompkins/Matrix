export type RequestType =
  | "Service Ticket"
  | "PM Kit"
  | "Stock Replenishment"
  | "Emergency Order";

export type OrderPriority = "Low" | "Normal" | "High" | "Critical";

export type OrderPartLine = {
  id: string;
  partNumber: string;
  partName: string;
  compatibleModel: string;
  currentStock: number;
  quantityNeeded: number;
  orderQuantity: number;
};

export type PrinterLink = {
  assetId: string;
  customer: string;
  model: string;
  ticketNumber: string;
  pmRequest: string;
};
