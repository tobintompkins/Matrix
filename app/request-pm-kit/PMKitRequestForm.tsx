"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import WorkflowPanel from "@/app/components/WorkflowPanel";
import { getWorkflowActions } from "@/lib/workflow/registry";
import { useWorkflowContext } from "@/lib/workflow/use-workflow-context";
import {
  createInitialPartRequests,
  pmPartCatalog,
  pmTypes,
  printerOptions,
} from "@/lib/pm-kit/data";
import type { PMPartRequest, PMType } from "@/lib/pm-kit/types";

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

export default function PMKitRequestForm() {
  const workflowContext = useWorkflowContext();
  const [selectedAssetId, setSelectedAssetId] = useState(
    workflowContext.assetId ?? printerOptions[0].assetId,
  );
  const [pmType, setPmType] = useState<PMType>("Full PM Kit");
  const [parts, setParts] = useState<PMPartRequest[]>(createInitialPartRequests);
  const [submitted, setSubmitted] = useState(false);

  const printer = printerOptions.find((p) => p.assetId === selectedAssetId)!;

  const workflowActions = useMemo(
    () =>
      getWorkflowActions("pm-kit", {
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

  const neededParts = parts.filter((part) => part.needed);

  const { inStockParts, orderParts, estimatedPriority } = useMemo(() => {
    const inStock = neededParts.filter((part) => part.inStock);
    const toOrder = neededParts.filter((part) => !part.inStock);

    let priority = "Standard";
    if (toOrder.length >= 3) priority = "High";
    else if (toOrder.length >= 1) priority = "Medium";
    if (pmType === "Full PM Kit" && toOrder.length > 0) priority = "High";

    return {
      inStockParts: inStock,
      orderParts: toOrder,
      estimatedPriority: priority,
    };
  }, [neededParts, pmType]);

  function updatePart(id: string, updates: Partial<PMPartRequest>) {
    setParts((current) =>
      current.map((part) =>
        part.id === id ? { ...part, ...updates } : part,
      ),
    );
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div>
        <Link
          href="/dashboard"
          className="text-sm text-cyan-400 hover:text-cyan-300"
        >
          ← Back to Service Hub
        </Link>
      </div>

      {submitted && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-6 py-4 text-emerald-200">
          PM kit request captured locally. Ordering integration coming in a
          future release.
        </div>
      )}

      <SectionCard
        title="Printer Selection"
        description="Select the printer for this PM kit request."
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

          <div className="md:col-span-2">
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
        </div>
      </SectionCard>

      <SectionCard
        title="PM Type"
        description="Choose the preventive maintenance scope for this request."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {pmTypes.map((type) => (
            <label
              key={type}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition ${
                pmType === type
                  ? "border-cyan-500 bg-cyan-500/10"
                  : "border-slate-700 bg-slate-950/60 hover:border-slate-600"
              }`}
            >
              <input
                type="radio"
                name="pmType"
                value={type}
                checked={pmType === type}
                onChange={() => setPmType(type)}
                className="accent-cyan-500"
              />
              <span className="text-sm font-medium text-white">{type}</span>
            </label>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Parts Needed"
        description="Review PM parts, stock status, and quantities."
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-400">
              <tr>
                <th className="pb-3 font-medium">Needed</th>
                <th className="pb-3 font-medium">Part</th>
                <th className="pb-3 font-medium">In Stock</th>
                <th className="pb-3 font-medium">Qty Needed</th>
                <th className="pb-3 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {parts.map((part) => (
                <tr key={part.id} className="border-t border-slate-800">
                  <td className="py-4">
                    <input
                      type="checkbox"
                      checked={part.needed}
                      onChange={(e) =>
                        updatePart(part.id, { needed: e.target.checked })
                      }
                      className="h-4 w-4 rounded accent-cyan-500"
                    />
                  </td>
                  <td className="py-4 font-medium text-white">{part.name}</td>
                  <td className="py-4">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                        part.inStock
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-rose-500/15 text-rose-300"
                      }`}
                    >
                      {part.inStock
                        ? `Yes (${part.stockQty} on hand)`
                        : "No — order required"}
                    </span>
                  </td>
                  <td className="py-4">
                    <input
                      type="number"
                      min={1}
                      max={99}
                      disabled={!part.needed}
                      value={part.quantity}
                      onChange={(e) =>
                        updatePart(part.id, {
                          quantity: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                      className="w-20 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-white disabled:opacity-40"
                    />
                  </td>
                  <td className="py-4">
                    <input
                      type="text"
                      disabled={!part.needed}
                      placeholder="Optional notes"
                      value={part.notes}
                      onChange={(e) =>
                        updatePart(part.id, { notes: e.target.value })
                      }
                      className="w-full min-w-[160px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-white placeholder:text-slate-600 disabled:opacity-40"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs text-slate-500">
          Stock levels from warehouse inventory (hardcoded sample data).
        </p>
      </SectionCard>

      <SectionCard
        title="Order Summary"
        description="Review fulfillment before submitting the PM kit request."
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h4 className="text-sm font-semibold text-emerald-400">
              Parts Already in Stock
            </h4>
            {inStockParts.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">None selected.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {inStockParts.map((part) => (
                  <li
                    key={part.id}
                    className="rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-2 text-sm text-slate-200"
                  >
                    {part.name} × {part.quantity}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h4 className="text-sm font-semibold text-amber-400">
              Parts Needing Order
            </h4>
            {orderParts.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">
                No parts require ordering.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {orderParts.map((part) => (
                  <li
                    key={part.id}
                    className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-2 text-sm text-amber-100"
                  >
                    {part.name} × {part.quantity}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-800 pt-6">
          <div>
            <p className="text-sm text-slate-400">Estimated Priority</p>
            <p
              className={`mt-1 text-lg font-bold ${
                estimatedPriority === "High"
                  ? "text-rose-400"
                  : estimatedPriority === "Medium"
                    ? "text-amber-400"
                    : "text-emerald-400"
              }`}
            >
              {estimatedPriority}
            </p>
          </div>

          <div className="text-right text-sm text-slate-400">
            <p>{neededParts.length} parts requested</p>
            <p>{pmType}</p>
            <p>{printer.assetId}</p>
          </div>
        </div>

        <button
          type="submit"
          disabled={neededParts.length === 0}
          className="mt-6 w-full rounded-xl bg-cyan-500 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
        >
          Submit Request
        </button>
      </SectionCard>

      <WorkflowPanel
        title="Workflow"
        description="Check inventory, build parts orders, and return to the service ticket."
        actions={workflowActions}
      />
    </form>
  );
}
