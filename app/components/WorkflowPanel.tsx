import Link from "next/link";
import type { WorkflowAction } from "@/lib/workflow/types";

const variantStyles: Record<
  NonNullable<WorkflowAction["variant"]>,
  string
> = {
  primary:
    "border-cyan-500/50 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20",
  accent:
    "border-emerald-500/50 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20",
  secondary: "border-slate-600 text-slate-200 hover:bg-slate-800",
};

type WorkflowPanelProps = {
  title?: string;
  description?: string;
  actions: WorkflowAction[];
  className?: string;
};

export default function WorkflowPanel({
  title = "Workflow",
  description = "Continue to related Matrix modules.",
  actions,
  className = "",
}: WorkflowPanelProps) {
  if (actions.length === 0) return null;

  return (
    <div
      className={`rounded-xl border border-slate-800 bg-slate-900 ${className}`}
    >
      <div className="border-b border-slate-800 px-6 py-4">
        <h3 className="text-lg font-bold">{title}</h3>
        {description && (
          <p className="mt-2 text-sm text-slate-400">{description}</p>
        )}
      </div>
      <div className="flex flex-wrap gap-3 p-6">
        {actions.map((action) => {
          const variant = action.variant ?? "secondary";

          return (
            <Link
              key={action.id}
              href={action.href}
              title={action.description}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${variantStyles[variant]}`}
            >
              {action.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
