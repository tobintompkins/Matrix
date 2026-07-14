import type { WorkflowContext, WorkflowModule } from "./types";

export const MODULE_LABELS: Record<WorkflowModule, string> = {
  customer: "Customer",
  "service-ticket": "Service Ticket",
  "digital-twin": "Printer",
  "start-pm": "PM",
  "pm-kit": "PM Kit Request",
  inventory: "Inventory",
  "parts-order-builder": "Parts Order Builder",
  "order-parts": "Order Parts",
  "knowledge-base": "Knowledge Base",
  "ai-technician": "Matrix Assist",
  fleet: "Fleet",
};

export function buildWorkflowUrl(
  path: string,
  context: WorkflowContext = {},
): string {
  const params = new URLSearchParams();

  if (context.ticket) params.set("ticket", context.ticket);
  if (context.printer) params.set("printer", context.printer);
  if (context.assetId) params.set("assetId", context.assetId);
  if (context.model) params.set("model", context.model);
  if (context.customer) params.set("customer", context.customer);
  if (context.from) params.set("from", context.from);

  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export function parseWorkflowContext(
  searchParams: URLSearchParams | ReadonlyURLSearchParamsLike,
): WorkflowContext {
  const from = searchParams.get("from");

  return {
    ticket: searchParams.get("ticket") ?? undefined,
    printer: searchParams.get("printer") ?? undefined,
    assetId: searchParams.get("assetId") ?? undefined,
    model: searchParams.get("model") ?? undefined,
    customer: searchParams.get("customer") ?? undefined,
    from: isWorkflowModule(from) ? from : undefined,
  };
}

type ReadonlyURLSearchParamsLike = {
  get(name: string): string | null;
};

function isWorkflowModule(value: string | null): value is WorkflowModule {
  return value !== null && value in MODULE_LABELS;
}

export function withFrom(
  context: WorkflowContext,
  from: WorkflowModule,
): WorkflowContext {
  return { ...context, from };
}

export function assetIdToPrinterSlug(assetId: string): string {
  return assetId.toLowerCase();
}
