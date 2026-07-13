"use client";

import { MODULE_LABELS } from "@/lib/workflow/routes";
import { useWorkflowContext } from "@/lib/workflow/use-workflow-context";

export default function WorkflowContextBanner() {
  const context = useWorkflowContext();

  if (!context.from) return null;

  const parts: string[] = [`Continued from ${MODULE_LABELS[context.from]}`];
  if (context.ticket) parts.push(`Ticket ${context.ticket}`);
  if (context.assetId) parts.push(context.assetId);
  if (context.model) parts.push(context.model);

  return (
    <div className="mb-6 rounded-xl border border-cyan-500/30 bg-cyan-500/5 px-5 py-3 text-sm text-cyan-200">
      {parts.join(" · ")}
    </div>
  );
}
