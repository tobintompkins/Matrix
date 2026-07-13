export type OrderPriority = "Low" | "Normal" | "High" | "Critical";

export type ShippingMethod =
  | "Standard Ground"
  | "Next Day Air"
  | "Will Call"
  | "Technician Van";

export type PartSource =
  | "PM Kit"
  | "Diagram"
  | "Manual Entry"
  | "Inventory Reorder";

export type PartsOrderLine = {
  itemNumber: number;
  partNumber: string;
  description: string;
  quantity: number;
  reason: string;
  source: PartSource;
};

export type PartsOrderPreview = {
  requesterName: string;
  requestDate: string;
  poNumber: string;
  customerServiceCall: string;
  shipToAddress: string;
  shippingMethod: ShippingMethod;
  priority: OrderPriority;
  specialInstructions: string;
  printerModel: string;
  serialNumber: string;
  assetId: string;
  location: string;
  relatedTicket: string;
  lines: PartsOrderLine[];
  technicianSignature: string;
  managerApproval: string;
  warehouseReview: string;
  dateSubmitted: string;
};
