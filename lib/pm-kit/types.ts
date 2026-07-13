export type PMType =
  | "Standard PM Clean"
  | "Full PM Kit"
  | "Feed System PM"
  | "Registration / Alignment PM";

export type PrinterOption = {
  assetId: string;
  customer: string;
  model: string;
  serialNumber: string;
  meterCount: number;
};

export type PMPartLine = {
  id: string;
  name: string;
  inStock: boolean;
  stockQty: number;
  defaultQty: number;
};

export type PMPartRequest = {
  id: string;
  name: string;
  inStock: boolean;
  stockQty: number;
  needed: boolean;
  quantity: number;
  notes: string;
};
