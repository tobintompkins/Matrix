export type PrinterModel = "GD9630" | "GL9730" | "Valezus" | "All";

export type DiagramCategory =
  | "Feed Unit"
  | "Registration"
  | "Sensors"
  | "Rollers"
  | "Transport"
  | "Exit Area"
  | "Ink / Supply"
  | "Duplex / Paper Path"
  | "Covers / Panels"
  | "Electrical";

export type PartCategory =
  | "All"
  | "Feed / Transport"
  | "Sensors"
  | "Consumables"
  | "Electrical"
  | "Covers";

export type DiagramRecord = {
  id: string;
  name: string;
  model: Exclude<PrinterModel, "All">;
  assembly: DiagramCategory;
  calloutCount: number;
  lastUpdated: string;
};

export type PartImageRecord = {
  id: string;
  partName: string;
  partNumber: string;
  compatibleModel: Exclude<PrinterModel, "All">;
  category: Exclude<PartCategory, "All">;
};
