import Link from "next/link";
import { WORKFLOW_CHAIN } from "@/lib/workflow/registry";
import { buildWorkflowUrl } from "@/lib/workflow/routes";
import type { WorkflowContext, WorkflowModule } from "@/lib/workflow/types";

type WorkflowChainProps = {
  current: WorkflowModule;
  context?: WorkflowContext;
  className?: string;
};

export default function WorkflowChain({
  current,
  context = {},
  className = "",
}: WorkflowChainProps) {
  const currentIndex = WORKFLOW_CHAIN.findIndex((step) => step.module === current);

  return (
    <div
      className={`rounded-xl border border-slate-800 bg-slate-900 px-4 py-4 ${className}`}
    >
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
        Service Workflow
      </p>
      <ol className="flex flex-wrap items-center gap-2">
        {WORKFLOW_CHAIN.map((step, index) => {
          const isCurrent = step.module === current;
          const isPast = currentIndex > index;
          const href = buildWorkflowUrl(step.path, {
            ...context,
            from: step.module,
          });

          return (
            <li key={step.module} className="flex items-center gap-2">
              {index > 0 && (
                <span className="text-slate-600" aria-hidden>
                  →
                </span>
              )}
              <Link
                href={href}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                  isCurrent
                    ? "border-cyan-500 bg-cyan-500/15 text-cyan-300"
                    : isPast
                      ? "border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                      : "border-slate-800 bg-slate-950/60 text-slate-500 hover:border-slate-700 hover:text-slate-300"
                }`}
              >
                {step.label}
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
