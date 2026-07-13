export type PrinterModelId = "GD9630" | "GL9730" | "Valezus";

export type CommonIssue = {
  issue: string;
  symptoms: string;
  likelyArea: string;
  firstChecks: string;
};

export type ModelKnowledge = {
  id: PrinterModelId;
  deviceType: string;
  supportedWorkflows: string[];
  pmInterval: string;
  commonServiceAreas: string[];
  commonIssues: CommonIssue[];
  pmKitParts: string[];
};
