import Link from "next/link";
import {
  getSampleWorkflowContext,
  SAMPLE_MATRIX_CONTEXT,
} from "@/lib/context/sample-context";
import { buildWorkflowUrl } from "@/lib/workflow/routes";

const actionStyles = {
  primary:
    "border-cyan-500/50 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20",
  secondary: "border-slate-600 text-slate-200 hover:bg-slate-800",
};

type ContextPanelProps = {
  className?: string;
};

export default function ContextPanel({ className = "" }: ContextPanelProps) {
  const ctx = getSampleWorkflowContext();
  const context = SAMPLE_MATRIX_CONTEXT;

  const quickActions = [
    {
      id: "digital-twin",
      label: "Open Digital Twin",
      href: buildWorkflowUrl("/digital-twin/MX-GD-002", ctx),
      variant: "primary" as const,
    },
    {
      id: "service-calls",
      label: "View Service Calls",
      href: buildWorkflowUrl("/service-calls", ctx),
      variant: "primary" as const,
    },
    {
      id: "service-ticket",
      label: "View Service Ticket",
      href: buildWorkflowUrl("/tickets", ctx),
      variant: "primary" as const,
    },
    {
      id: "pm-kit",
      label: "Request PM Kit",
      href: buildWorkflowUrl("/request-pm-kit", ctx),
      variant: "secondary" as const,
    },
    {
      id: "order-parts",
      label: "Order Parts",
      href: buildWorkflowUrl("/order-parts", ctx),
      variant: "secondary" as const,
    },
    {
      id: "ai-technician",
      label: "Launch AI Technician",
      href: buildWorkflowUrl("/ai-technician", ctx),
      variant: "secondary" as const,
    },
  ];

  const fields = [
    { label: "Customer", value: context.customer },
    { label: "Location", value: context.location },
    { label: "Printer", value: context.printer },
    { label: "Asset ID", value: context.assetId },
    { label: "Serial Number", value: context.serialNumber },
    { label: "Current Ticket", value: context.currentTicket },
    { label: "Current Workflow", value: context.currentWorkflow },
  ];

  return (
    <aside
      className={`rounded-xl border border-slate-800 bg-slate-900 ${className}`}
      aria-label="Matrix service context"
    >
      <div className="border-b border-slate-800 px-6 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
          Matrix Context
        </p>
        <h3 className="mt-1 text-lg font-bold text-white">Active Service Context</h3>
        <p className="mt-2 text-sm text-slate-400">
          Hardcoded sample context — live state management coming in a future
          release.
        </p>
      </div>

      <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {fields.map((field) => (
          <div
            key={field.label}
            className="rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-3"
          >
            <p className="text-xs text-slate-500">{field.label}</p>
            <p className="mt-1 text-sm font-medium text-white">{field.value}</p>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-800 px-6 py-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
          Quick Actions
        </p>
        <div className="flex flex-wrap gap-3">
          {quickActions.map((action) => (
            <Link
              key={action.id}
              href={action.href}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${actionStyles[action.variant]}`}
            >
              {action.label}
            </Link>
          ))}
        </div>
      </div>
    </aside>
  );
}
