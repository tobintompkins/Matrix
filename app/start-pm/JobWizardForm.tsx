"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import WorkflowPanel from "@/app/components/WorkflowPanel";
import { getWorkflowActions } from "@/lib/workflow/registry";
import { buildWorkflowUrl, withFrom } from "@/lib/workflow/routes";
import { useWorkflowContext } from "@/lib/workflow/use-workflow-context";
import {
  createInitialChecklist,
  jobTypes,
  laborEstimates,
  pmPartsInStock,
  pmPartsNeedingOrder,
  printerOptions,
  technicians,
} from "@/lib/job-wizard/data";
import type { ChecklistItem, JobType } from "@/lib/job-wizard/types";

function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

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
        <h3 className="text-xl font-bold">{title}</h3>
        {description && (
          <p className="mt-2 text-sm text-slate-400">{description}</p>
        )}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

export default function JobWizardForm() {
  const workflowContext = useWorkflowContext();
  const [jobType, setJobType] = useState<JobType>("Preventive Maintenance");
  const [selectedAssetId, setSelectedAssetId] = useState(
    workflowContext.assetId ?? printerOptions[0].assetId,
  );
  const [assignedTechnician, setAssignedTechnician] = useState(technicians[0]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(
    createInitialChecklist,
  );
  const [started, setStarted] = useState(false);

  const printer = printerOptions.find((p) => p.assetId === selectedAssetId)!;
  const isPM = jobType === "Preventive Maintenance";

  const workflowActions = useMemo(
    () =>
      getWorkflowActions("start-pm", {
        assetId: printer.assetId,
        printer: printer.assetId.toLowerCase(),
        model: printer.model,
        customer: printer.customer,
        ticket: workflowContext.ticket,
      }),
    [printer, workflowContext.ticket],
  );

  useEffect(() => {
    if (!workflowContext.assetId) return;
    const match = printerOptions.find(
      (p) => p.assetId === workflowContext.assetId,
    );
    if (match) setSelectedAssetId(match.assetId);
  }, [workflowContext.assetId]);

  const checklistProgress = useMemo(() => {
    const completed = checklist.filter((item) => item.completed).length;
    return { completed, total: checklist.length };
  }, [checklist]);

  function toggleChecklistItem(id: string) {
    setChecklist((current) =>
      current.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item,
      ),
    );
  }

  function handleStartJob(event: React.FormEvent) {
    event.preventDefault();
    setStarted(true);
  }

  return (
    <form onSubmit={handleStartJob} className="space-y-8">
      <div>
        <Link
          href="/dashboard"
          className="text-sm text-cyan-400 hover:text-cyan-300"
        >
          ← Back to Service Hub
        </Link>
      </div>

      {started && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-6 py-4 text-emerald-200">
          Job started locally for {printer.assetId}. Full workflow integration
          coming in a future release.
        </div>
      )}

      <SectionCard
        title="Job Type Selection"
        description="Choose the type of field service job to begin."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {jobTypes.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setJobType(type)}
              className={`rounded-lg border px-4 py-4 text-left text-sm font-medium transition ${
                jobType === type
                  ? "border-cyan-500 bg-cyan-500/10 text-cyan-300"
                  : "border-slate-700 bg-slate-950/60 text-slate-200 hover:border-slate-600 hover:bg-slate-800"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Printer Selection"
        description="Select the printer for this service job."
      >
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm text-slate-400">Customer</label>
            <input
              type="text"
              readOnly
              value={printer.customer}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-white"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-400">Asset ID</label>
            <select
              value={selectedAssetId}
              onChange={(e) => setSelectedAssetId(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            >
              {printerOptions.map((option) => (
                <option key={option.assetId} value={option.assetId}>
                  {option.assetId}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-400">
              Printer Model
            </label>
            <input
              type="text"
              readOnly
              value={printer.model}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-white"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-400">
              Serial Number
            </label>
            <input
              type="text"
              readOnly
              value={printer.serialNumber}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-white"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-400">
              Current Meter Count
            </label>
            <input
              type="text"
              readOnly
              value={formatNumber(printer.meterCount)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-white"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-400">Location</label>
            <input
              type="text"
              readOnly
              value={printer.location}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-white"
            />
          </div>
        </div>
      </SectionCard>

      {isPM && (
        <SectionCard
          title="PM Checklist"
          description={`${checklistProgress.completed} of ${checklistProgress.total} items completed.`}
        >
          <ul className="space-y-3">
            {checklist.map((item) => (
              <li key={item.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-3 transition hover:border-slate-700">
                  <input
                    type="checkbox"
                    checked={item.completed}
                    onChange={() => toggleChecklistItem(item.id)}
                    className="h-4 w-4 rounded accent-cyan-500"
                  />
                  <span
                    className={
                      item.completed
                        ? "text-slate-400 line-through"
                        : "text-slate-200"
                    }
                  >
                    {item.label}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {isPM && (
        <SectionCard
          title="Parts Needed"
          description="Review PM kit requirements and warehouse availability."
        >
          <div className="mb-4 rounded-lg border border-cyan-500/30 bg-cyan-500/5 px-4 py-3 text-sm text-cyan-200">
            PM kit required for this preventive maintenance job.
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h4 className="text-sm font-semibold text-emerald-400">
                Parts in Stock
              </h4>
              <ul className="mt-3 space-y-2">
                {pmPartsInStock.map((part) => (
                  <li
                    key={part}
                    className="rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-2 text-sm text-slate-200"
                  >
                    {part}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-amber-400">
                Parts Needing Order
              </h4>
              <ul className="mt-3 space-y-2">
                {pmPartsNeedingOrder.map((part) => (
                  <li
                    key={part}
                    className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-2 text-sm text-amber-100"
                  >
                    {part}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <Link
            href={buildWorkflowUrl(
              "/request-pm-kit",
              withFrom(
                {
                  assetId: printer.assetId,
                  printer: printer.assetId.toLowerCase(),
                  model: printer.model,
                  customer: printer.customer,
                  ticket: workflowContext.ticket,
                },
                "start-pm",
              ),
            )}
            className="mt-6 inline-block rounded-lg border border-cyan-500/50 bg-cyan-500/10 px-5 py-2.5 text-sm font-medium text-cyan-300 transition hover:bg-cyan-500/20"
          >
            Request PM Kit
          </Link>
        </SectionCard>
      )}

      <SectionCard
        title="Job Summary"
        description="Review job details before starting."
      >
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
            <p className="text-sm text-slate-400">Job Type</p>
            <p className="mt-2 font-semibold text-white">{jobType}</p>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
            <p className="text-sm text-slate-400">Estimated Labor Time</p>
            <p className="mt-2 font-semibold text-cyan-400">
              {laborEstimates[jobType]}
            </p>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
            <label className="text-sm text-slate-400">Assigned Technician</label>
            <select
              value={assignedTechnician}
              onChange={(e) => setAssignedTechnician(e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
            >
              {technicians.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
            <p className="text-sm text-slate-400">Printer</p>
            <p className="mt-2 font-semibold text-white">{printer.assetId}</p>
            <p className="text-xs text-slate-500">{printer.model}</p>
          </div>
        </div>

        {isPM && (
          <p className="mt-4 text-sm text-slate-400">
            Checklist progress: {checklistProgress.completed}/
            {checklistProgress.total} items
          </p>
        )}

        <button
          type="submit"
          className="mt-6 w-full rounded-xl bg-cyan-500 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 sm:w-auto"
        >
          Start Job
        </button>
      </SectionCard>

      <WorkflowPanel
        title="Workflow"
        description="Continue to PM kit requests, inventory, tickets, and parts ordering."
        actions={workflowActions}
      />
    </form>
  );
}
