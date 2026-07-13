"use client";

import { useEffect, useState } from "react";
import WorkflowPanel from "@/app/components/WorkflowPanel";
import { getWorkflowActions } from "@/lib/workflow/registry";
import { useWorkflowContext } from "@/lib/workflow/use-workflow-context";
import {
  modelIds,
  modelKnowledge,
  serviceReferences,
} from "@/lib/knowledge-base/data";
import type { PrinterModelId } from "@/lib/knowledge-base/types";

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900">
      <div className="border-b border-slate-800 px-6 py-4">
        <h3 className="text-lg font-bold">{title}</h3>
        {description && (
          <p className="mt-2 text-sm text-slate-400">{description}</p>
        )}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

export default function KnowledgeBasePanel() {
  const workflowContext = useWorkflowContext();
  const [selectedModel, setSelectedModel] = useState<PrinterModelId>(
    (workflowContext.model as PrinterModelId) ?? "GD9630",
  );
  const model = modelKnowledge[selectedModel];

  useEffect(() => {
    if (
      workflowContext.model &&
      modelIds.includes(workflowContext.model as PrinterModelId)
    ) {
      setSelectedModel(workflowContext.model as PrinterModelId);
    }
  }, [workflowContext.model]);

  const workflowActions = getWorkflowActions("knowledge-base", {
    model: selectedModel,
  });

  return (
    <div className="space-y-8">
      <WorkflowPanel
        title="Workflow"
        description="Open diagrams, AI troubleshooting, and PM guides for this model."
        actions={workflowActions}
      />
      <SectionCard
        title="Model Selector"
        description="Choose a printer model to view service knowledge."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {modelIds.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setSelectedModel(id)}
              className={`rounded-xl border px-5 py-6 text-left transition ${
                selectedModel === id
                  ? "border-cyan-500 bg-cyan-500/10"
                  : "border-slate-700 bg-slate-950/60 hover:border-slate-600 hover:bg-slate-800"
              }`}
            >
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Series Model
              </p>
              <p
                className={`mt-2 text-2xl font-bold ${
                  selectedModel === id ? "text-cyan-300" : "text-white"
                }`}
              >
                {id}
              </p>
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Model Overview">
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <p className="text-sm text-slate-400">Model</p>
            <p className="mt-1 text-xl font-bold text-cyan-400">{model.id}</p>
          </div>
          <div>
            <p className="text-sm text-slate-400">Device Type</p>
            <p className="mt-1 font-medium text-white">{model.deviceType}</p>
          </div>
          <div>
            <p className="text-sm text-slate-400">PM Interval</p>
            <p className="mt-1 font-medium text-white">{model.pmInterval}</p>
          </div>
          <div>
            <p className="text-sm text-slate-400">Supported Workflows</p>
            <ul className="mt-2 space-y-1">
              {model.supportedWorkflows.map((workflow) => (
                <li key={workflow} className="text-sm text-slate-300">
                  • {workflow}
                </li>
              ))}
            </ul>
          </div>
          <div className="md:col-span-2">
            <p className="text-sm text-slate-400">Common Service Areas</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {model.commonServiceAreas.map((area) => (
                <span
                  key={area}
                  className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-xs text-slate-300"
                >
                  {area}
                </span>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Common Issues"
        description={`Frequent field issues for ${model.id}.`}
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-400">
              <tr>
                <th className="pb-3 font-medium">Issue</th>
                <th className="pb-3 font-medium">Symptoms</th>
                <th className="pb-3 font-medium">Likely Area</th>
                <th className="pb-3 font-medium">First Checks</th>
              </tr>
            </thead>
            <tbody>
              {model.commonIssues.map((row) => (
                <tr
                  key={row.issue}
                  className="border-t border-slate-800 text-slate-200"
                >
                  <td className="py-4 font-medium text-white">{row.issue}</td>
                  <td className="py-4 text-slate-300">{row.symptoms}</td>
                  <td className="py-4 text-slate-300">{row.likelyArea}</td>
                  <td className="py-4 text-slate-300">{row.firstChecks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        title="PM Kit Information"
        description="Recommended preventive maintenance parts for this model."
      >
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {model.pmKitParts.map((part) => (
            <li
              key={part}
              className="rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-200"
            >
              {part}
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard
        title="Service References"
        description="Documentation placeholders — documents not hosted yet."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {serviceReferences.map((ref) => (
            <div
              key={ref.id}
              className="rounded-lg border border-dashed border-slate-700 bg-slate-950/40 px-4 py-6 text-center"
            >
              <p className="font-medium text-white">{ref.title}</p>
              <p className="mt-2 text-xs text-slate-500">{ref.description}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 px-6 py-6">
        <h3 className="text-lg font-bold text-cyan-400">Matrix AI Ready</h3>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300">
          This knowledge base will help the AI Technician provide model-specific
          troubleshooting recommendations in a future phase.
        </p>
      </div>
    </div>
  );
}
