export type WorkflowModule =
  | "customer"
  | "digital-twin"
  | "service-ticket"
  | "start-pm"
  | "pm-kit"
  | "inventory"
  | "parts-order-builder"
  | "order-parts"
  | "knowledge-base"
  | "ai-technician"
  | "fleet";

export type WorkflowContext = {
  ticket?: string;
  printer?: string;
  assetId?: string;
  model?: string;
  customer?: string;
  from?: WorkflowModule;
};

export type WorkflowAction = {
  id: string;
  label: string;
  href: string;
  variant?: "primary" | "secondary" | "accent";
  description?: string;
};

export type WorkflowStep = {
  module: WorkflowModule;
  label: string;
  path: string;
};
