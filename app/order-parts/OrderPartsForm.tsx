"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import WorkflowPanel from "@/app/components/WorkflowPanel";
import { getWorkflowActions } from "@/lib/workflow/registry";
import { useWorkflowContext } from "@/lib/workflow/use-workflow-context";
import {
  createInitialOrderParts,
  getOrderQuantity,
  getPartStatus,
  priorities,
  printerLinks,
  requestTypes,
} from "@/lib/order-parts/data";
import type { OrderPartLine, OrderPriority, RequestType } from "@/lib/order-parts/types";

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

const statusStyles: Record<string, string> = {
  "In Stock": "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30",
  "Low Stock": "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30",
  "Order Required": "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30",
};

const priorityStyles: Record<OrderPriority, string> = {
  Low: "text-slate-400",
  Normal: "text-cyan-400",
  High: "text-amber-400",
  Critical: "text-rose-400",
};

export default function OrderPartsForm() {
  const workflowContext = useWorkflowContext();
  const [requestType, setRequestType] = useState<RequestType>("Service Ticket");
  const [priority, setPriority] = useState<OrderPriority>("High");
  const [neededByDate, setNeededByDate] = useState("2026-07-10");
  const [requestedBy, setRequestedBy] = useState("Toby Tompkins");
  const [selectedAssetId, setSelectedAssetId] = useState(
    workflowContext.assetId ?? printerLinks[0].assetId,
  );
  const [parts, setParts] = useState<OrderPartLine[]>(createInitialOrderParts);
  const [submitted, setSubmitted] = useState(false);

  const printer = printerLinks.find((p) => p.assetId === selectedAssetId)!;

  const workflowActions = useMemo(
    () =>
      getWorkflowActions("order-parts", {
        ticket: workflowContext.ticket ?? printer.ticketNumber,
        assetId: printer.assetId,
        printer: printer.assetId.toLowerCase(),
        model: printer.model,
        customer: printer.customer,
      }),
    [printer, workflowContext.ticket],
  );

  useEffect(() => {
    if (!workflowContext.assetId) return;
    const match = printerLinks.find((p) => p.assetId === workflowContext.assetId);
    if (match) setSelectedAssetId(match.assetId);
  }, [workflowContext.assetId]);

  const requestedParts = parts.filter((part) => part.quantityNeeded > 0);

  const summary = useMemo(() => {
    const inStock: OrderPartLine[] = [];
    const needingOrder: OrderPartLine[] = [];

    for (const part of requestedParts) {
      const status = getPartStatus(part);
      const orderQty = getOrderQuantity(part);
      if (status === "In Stock" && orderQty === 0) {
        inStock.push(part);
      } else {
        needingOrder.push(part);
      }
    }

    return {
      totalItems: requestedParts.length,
      inStock,
      needingOrder,
    };
  }, [requestedParts]);

  function updatePart(id: string, updates: Partial<OrderPartLine>) {
    setParts((current) =>
      current.map((part) => (part.id === id ? { ...part, ...updates } : part)),
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
          Order request captured locally. Parts ordering integration coming in a
          future release.
        </div>
      )}

      <SectionCard
        title="Order Information"
        description="Define the request type, priority, and delivery timeline."
      >
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm text-slate-400">
              Request Type
            </label>
            <select
              value={requestType}
              onChange={(e) => setRequestType(e.target.value as RequestType)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            >
              {requestTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-400">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as OrderPriority)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            >
              {priorities.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-400">
              Needed By Date
            </label>
            <input
              type="date"
              value={neededByDate}
              onChange={(e) => setNeededByDate(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-400">
              Requested By
            </label>
            <input
              type="text"
              value={requestedBy}
              onChange={(e) => setRequestedBy(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Printer / Ticket Link"
        description="Associate this order with a customer asset and related service records."
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
              {printerLinks.map((option) => (
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
              Related Ticket Number
            </label>
            <input
              type="text"
              readOnly
              value={printer.ticketNumber}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-cyan-400"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-sm text-slate-400">
              Related PM Request
            </label>
            <input
              type="text"
              readOnly
              value={printer.pmRequest}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-white"
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Parts List"
        description="Review parts, stock levels, and order quantities."
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-400">
              <tr>
                <th className="pb-3 font-medium">Part #</th>
                <th className="pb-3 font-medium">Part Name</th>
                <th className="pb-3 font-medium">Compatible Model</th>
                <th className="pb-3 font-medium">Qty Needed</th>
                <th className="pb-3 font-medium">Current Stock</th>
                <th className="pb-3 font-medium">Order Qty</th>
                <th className="pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {parts.map((part) => {
                const status = getPartStatus(part);
                const suggestedOrder = Math.max(
                  0,
                  part.quantityNeeded - part.currentStock,
                );

                return (
                  <tr key={part.id} className="border-t border-slate-800">
                    <td className="py-4 font-medium text-cyan-400">
                      {part.partNumber}
                    </td>
                    <td className="py-4 text-white">{part.partName}</td>
                    <td className="py-4 text-slate-300">
                      {part.compatibleModel}
                    </td>
                    <td className="py-4">
                      <input
                        type="number"
                        min={0}
                        max={99}
                        value={part.quantityNeeded}
                        onChange={(e) =>
                          updatePart(part.id, {
                            quantityNeeded: Math.max(
                              0,
                              Number(e.target.value) || 0,
                            ),
                          })
                        }
                        className="w-20 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-white"
                      />
                    </td>
                    <td className="py-4 text-slate-300">{part.currentStock}</td>
                    <td className="py-4">
                      <input
                        type="number"
                        min={0}
                        max={99}
                        value={part.orderQuantity || suggestedOrder}
                        onChange={(e) =>
                          updatePart(part.id, {
                            orderQuantity: Math.max(
                              0,
                              Number(e.target.value) || 0,
                            ),
                          })
                        }
                        className="w-20 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-white"
                      />
                    </td>
                    <td className="py-4">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                          statusStyles[status]
                        }`}
                      >
                        {status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        title="Order Summary"
        description="Review fulfillment breakdown before submitting."
      >
        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
            <p className="text-sm text-slate-400">Total Items Requested</p>
            <p className="mt-2 text-3xl font-bold">{summary.totalItems}</p>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
            <p className="text-sm text-slate-400">Items Already in Stock</p>
            <p className="mt-2 text-3xl font-bold text-emerald-400">
              {summary.inStock.length}
            </p>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
            <p className="text-sm text-slate-400">Items Needing Order</p>
            <p className="mt-2 text-3xl font-bold text-amber-400">
              {summary.needingOrder.length}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div>
            <h4 className="text-sm font-semibold text-emerald-400">
              Fulfill from Stock
            </h4>
            {summary.inStock.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">None.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {summary.inStock.map((part) => (
                  <li
                    key={part.id}
                    className="rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-2 text-sm text-slate-200"
                  >
                    {part.partName} × {part.quantityNeeded}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h4 className="text-sm font-semibold text-amber-400">
              Requires Purchase Order
            </h4>
            {summary.needingOrder.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">None.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {summary.needingOrder.map((part) => (
                  <li
                    key={part.id}
                    className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-2 text-sm text-amber-100"
                  >
                    {part.partName} × {getOrderQuantity(part)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-800 pt-6">
          <div>
            <p className="text-sm text-slate-400">Priority Level</p>
            <p className={`mt-1 text-lg font-bold ${priorityStyles[priority]}`}>
              {priority}
            </p>
          </div>

          <div className="text-right text-sm text-slate-400">
            <p>{requestType}</p>
            <p>Needed by {neededByDate}</p>
            <p>{requestedBy}</p>
          </div>
        </div>

        <button
          type="submit"
          disabled={summary.totalItems === 0}
          className="mt-6 w-full rounded-xl bg-cyan-500 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
        >
          Submit Order Request
        </button>
      </SectionCard>

      <WorkflowPanel
        title="Workflow"
        description="Attach this order to the service ticket or continue parts planning."
        actions={workflowActions}
      />
    </form>
  );
}
