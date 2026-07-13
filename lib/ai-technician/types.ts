export type IssueCategory =
  | "Paper Jam"
  | "Feed Issue"
  | "Image Quality"
  | "Registration"
  | "Network"
  | "Ink / Supply"
  | "Sensor"
  | "Preventive Maintenance";

export type ContextPrinter = {
  assetId: string;
  customer: string;
  model: string;
  serialNumber: string;
  meterCount: number;
  errorCode: string;
};

export type SuggestedCheck = {
  id: string;
  label: string;
  completed: boolean;
};

export type RelatedItem = {
  id: string;
  title: string;
  detail: string;
};
