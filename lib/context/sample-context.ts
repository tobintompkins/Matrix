import type { WorkflowContext } from "@/lib/workflow/types";

export type MatrixSampleContext = {
  customer: string;
  location: string;
  printer: string;
  assetId: string;
  serialNumber: string;
  currentTicket: string;
  currentWorkflow: string;
};

export const SAMPLE_MATRIX_CONTEXT: MatrixSampleContext = {
  customer: "SFX / MPX",
  location: "Southern Maine",
  printer: "GD9630",
  assetId: "GD-9630-001",
  serialNumber: "GD9630-SN-001",
  currentTicket: "TCK-1001",
  currentWorkflow: "PM / Parts Ordering",
};

/** Workflow URLs derived from sample context (navigation only). */
export function getSampleWorkflowContext(): WorkflowContext {
  return {
    customer: SAMPLE_MATRIX_CONTEXT.customer,
    assetId: "MX-GD-002",
    printer: "mx-gd-002",
    model: SAMPLE_MATRIX_CONTEXT.printer,
    ticket: SAMPLE_MATRIX_CONTEXT.currentTicket,
  };
}
