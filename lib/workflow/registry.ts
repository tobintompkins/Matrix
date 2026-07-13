import { assetIdToPrinterSlug, buildWorkflowUrl, withFrom } from "./routes";
import type {
  WorkflowAction,
  WorkflowContext,
  WorkflowModule,
  WorkflowStep,
} from "./types";

/**
 * Canonical Matrix service workflow (navigation only).
 *
 * Customer → Printer → Service Ticket → PM → Inventory
 *   → Order Parts → Knowledge Base → AI Technician
 */
export const WORKFLOW_CHAIN: WorkflowStep[] = [
  { module: "customer", label: "Customer", path: "/customers" },
  { module: "digital-twin", label: "Printer", path: "/digital-twin" },
  { module: "service-ticket", label: "Service Ticket", path: "/tickets" },
  { module: "start-pm", label: "PM", path: "/start-pm" },
  { module: "inventory", label: "Inventory", path: "/inventory" },
  { module: "order-parts", label: "Order Parts", path: "/order-parts" },
  { module: "knowledge-base", label: "Knowledge Base", path: "/knowledge-base" },
  { module: "ai-technician", label: "AI Technician", path: "/ai-technician" },
];

const CHAIN_PATH_OVERRIDES: Partial<Record<WorkflowModule, (ctx: WorkflowContext) => string>> = {
  "digital-twin": (ctx) => printerPath(ctx),
};

function printerPath(context: WorkflowContext): string {
  if (context.assetId) {
    return `/digital-twin/${context.assetId}`;
  }
  const slug =
    context.printer ??
    (context.assetId ? assetIdToPrinterSlug(context.assetId) : undefined);
  return slug ? `/digital-twin/${slug.toUpperCase()}` : "/digital-twin";
}

function chainIndex(module: WorkflowModule): number {
  return WORKFLOW_CHAIN.findIndex((step) => step.module === module);
}

function chainStepPath(step: WorkflowStep, context: WorkflowContext): string {
  const override = CHAIN_PATH_OVERRIDES[step.module];
  return override ? override(context) : step.path;
}

export function getNextChainStep(
  module: WorkflowModule,
): WorkflowStep | undefined {
  const index = chainIndex(module);
  if (index === -1 || index >= WORKFLOW_CHAIN.length - 1) return undefined;
  return WORKFLOW_CHAIN[index + 1];
}

export function getPreviousChainStep(
  module: WorkflowModule,
): WorkflowStep | undefined {
  const index = chainIndex(module);
  if (index <= 0) return undefined;
  return WORKFLOW_CHAIN[index - 1];
}

function nextAction(
  module: WorkflowModule,
  context: WorkflowContext,
  label?: string,
): WorkflowAction | undefined {
  const next = getNextChainStep(module);
  if (!next) return undefined;

  return {
    id: `next-${next.module}`,
    label: label ?? `Continue to ${next.label}`,
    href: buildWorkflowUrl(chainStepPath(next, context), withFrom(context, module)),
    variant: "primary",
  };
}

function previousAction(
  module: WorkflowModule,
  context: WorkflowContext,
  label?: string,
): WorkflowAction | undefined {
  const previous = getPreviousChainStep(module);
  if (!previous) return undefined;

  return {
    id: `prev-${previous.module}`,
    label: label ?? `Back to ${previous.label}`,
    href: buildWorkflowUrl(
      chainStepPath(previous, context),
      withFrom(context, module),
    ),
  };
}

function action(
  id: string,
  label: string,
  path: string,
  context: WorkflowContext,
  from: WorkflowModule,
  variant: WorkflowAction["variant"] = "secondary",
): WorkflowAction {
  return {
    id,
    label,
    href: buildWorkflowUrl(path, withFrom(context, from)),
    variant,
  };
}

export function getWorkflowActions(
  module: WorkflowModule,
  context: WorkflowContext = {},
): WorkflowAction[] {
  const base: WorkflowContext = {
    ticket: context.ticket,
    printer: context.printer ?? "mx-gd-002",
    assetId: context.assetId ?? "MX-GD-002",
    model: context.model ?? "GD9630",
    customer: context.customer ?? "SFX / MPX",
  };

  const actions: WorkflowAction[] = [];

  const next = nextAction(module, base);
  const prev = previousAction(module, base);
  if (next) actions.push(next);
  if (prev) actions.push(prev);

  switch (module) {
    case "customer":
      actions.push(
        action(
          "view-fleet",
          "View All Printers",
          "/fleet",
          base,
          "customer",
          "accent",
        ),
      );
      break;

    case "digital-twin":
      actions.push(
        action(
          "request-pm-kit",
          "Request PM Kit",
          "/request-pm-kit",
          base,
          "digital-twin",
        ),
        action(
          "parts-order-builder",
          "Parts Order Builder",
          "/parts-order-builder",
          base,
          "digital-twin",
        ),
      );
      break;

    case "service-ticket":
      actions.push(
        action(
          "open-printer",
          "Open Printer",
          printerPath(base),
          base,
          "service-ticket",
          "accent",
        ),
        action(
          "parts-order-builder",
          "Parts Order Builder",
          "/parts-order-builder",
          base,
          "service-ticket",
        ),
      );
      break;

    case "start-pm":
      actions.push(
        action(
          "request-pm-kit",
          "Request PM Kit",
          "/request-pm-kit",
          base,
          "start-pm",
          "accent",
        ),
        action(
          "open-ticket",
          "View Service Ticket",
          "/tickets",
          base,
          "start-pm",
        ),
      );
      break;

    case "inventory":
      actions.push(
        action(
          "parts-order-builder",
          "Parts Order Builder",
          "/parts-order-builder",
          base,
          "inventory",
          "accent",
        ),
        action("view-tickets", "View Service Tickets", "/tickets", base, "inventory"),
      );
      break;

    case "order-parts":
      actions.push(
        action(
          "parts-order-builder",
          "Parts Order Builder",
          "/parts-order-builder",
          base,
          "order-parts",
          "accent",
        ),
        action("view-inventory", "View Inventory", "/inventory", base, "order-parts"),
      );
      break;

    case "knowledge-base":
      actions.push(
        action(
          "open-diagram",
          "Open Diagram",
          "/parts-order-builder",
          base,
          "knowledge-base",
          "accent",
        ),
        action("open-pm", "Open PM", "/start-pm", base, "knowledge-base"),
      );
      break;

    case "ai-technician":
      actions.push(
        action(
          "back-customer",
          "Back to Customer",
          "/customers",
          base,
          "ai-technician",
          "accent",
        ),
        action(
          "open-ticket",
          "View Service Ticket",
          "/tickets",
          base,
          "ai-technician",
        ),
        action(
          "open-printer",
          "Open Printer",
          printerPath(base),
          base,
          "ai-technician",
        ),
      );
      break;

    case "pm-kit":
      actions.push(
        nextAction("pm-kit", base, "Continue to Inventory") ??
          action("inventory", "Inventory Check", "/inventory", base, "pm-kit", "primary"),
        action("start-pm", "Start PM", "/start-pm", base, "pm-kit"),
        action(
          "parts-order-builder",
          "Parts Order Builder",
          "/parts-order-builder",
          base,
          "pm-kit",
        ),
      );
      break;

    case "parts-order-builder":
      actions.push(
        action(
          "generate-order",
          "Generate Order Form",
          "/order-parts",
          base,
          "parts-order-builder",
          "accent",
        ),
        action(
          "attach-ticket",
          "Attach to Service Ticket",
          "/tickets",
          base,
          "parts-order-builder",
        ),
      );
      break;

    case "fleet":
      actions.push(
        action(
          "open-printer",
          "Open Printer",
          printerPath(base),
          base,
          "fleet",
          "accent",
        ),
        nextAction("fleet", base, "Continue to Service Ticket") ??
          action("tickets", "Service Ticket", "/tickets", base, "fleet", "primary"),
      );
      break;

    default:
      break;
  }

  const seen = new Set<string>();
  return actions.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}
