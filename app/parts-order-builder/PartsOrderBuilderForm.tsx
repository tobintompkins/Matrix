"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import WorkflowPanel from "@/app/components/WorkflowPanel";
import { getWorkflowActions } from "@/lib/workflow/registry";
import { useWorkflowContext } from "@/lib/workflow/use-workflow-context";
import {
  assemblySections,
  createInitialSelectedParts,
  customers,
  getCalloutsForSelection,
  getSuggestedOrderQuantity,
  priorities,
  printerModels,
  serialNumbers,
  serviceTickets,
  shippingMethods,
} from "@/lib/parts-order-builder/data";
import type {
  AssemblySection,
  DiagramCallout,
  OrderPriority,
  PrinterModel,
  SelectedPartLine,
  ShippingMethod,
} from "@/lib/parts-order-builder/types";

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

const inputClassName =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500";

const priorityStyles: Record<OrderPriority, string> = {
  Low: "text-slate-400",
  Normal: "text-cyan-400",
  High: "text-amber-400",
  Critical: "text-rose-400",
};

export default function PartsOrderBuilderForm() {
  const workflowContext = useWorkflowContext();
  const [requesterName, setRequesterName] = useState("Toby Tompkins");
  const [requestDate, setRequestDate] = useState("2026-07-08");
  const [customer, setCustomer] = useState(
    workflowContext.customer ?? customers[0],
  );
  const [ticketNumber, setTicketNumber] = useState(
    workflowContext.ticket ?? serviceTickets[0],
  );
  const [headerPrinterModel, setHeaderPrinterModel] = useState<PrinterModel>(
    (workflowContext.model as PrinterModel) ?? "GD9630",
  );
  const [serialNumber, setSerialNumber] = useState(
    serialNumbers[
      ((workflowContext.model as PrinterModel) ?? "GD9630") as PrinterModel
    ][0],
  );
  const [priority, setPriority] = useState<OrderPriority>("High");
  const [shippingMethod, setShippingMethod] =
    useState<ShippingMethod>("Next Day Air");
  const [specialInstructions, setSpecialInstructions] = useState(
    "Deliver to technician van before Friday dispatch.",
  );

  const [diagramModel, setDiagramModel] = useState<PrinterModel>(
    (workflowContext.model as PrinterModel) ?? "GD9630",
  );
  const [assembly, setAssembly] = useState<AssemblySection>("Feed Unit");
  const [selectedCallout, setSelectedCallout] = useState<DiagramCallout | null>(
    null,
  );
  const [selectedPartName, setSelectedPartName] = useState("");

  const [parts, setParts] = useState<SelectedPartLine[]>(
    createInitialSelectedParts,
  );
  const [submitted, setSubmitted] = useState(false);
  const [exportNotice, setExportNotice] = useState(false);

  const availableCallouts = getCalloutsForSelection(diagramModel, assembly);

  const workflowActions = useMemo(
    () =>
      getWorkflowActions("parts-order-builder", {
        ticket: ticketNumber,
        assetId: workflowContext.assetId,
        printer: workflowContext.printer,
        model: headerPrinterModel,
        customer,
      }),
    [
      ticketNumber,
      workflowContext.assetId,
      workflowContext.printer,
      headerPrinterModel,
      customer,
    ],
  );

  useEffect(() => {
    if (workflowContext.ticket && serviceTickets.includes(workflowContext.ticket)) {
      setTicketNumber(workflowContext.ticket);
    }
    if (workflowContext.customer && customers.includes(workflowContext.customer)) {
      setCustomer(workflowContext.customer);
    }
    if (
      workflowContext.model &&
      printerModels.includes(workflowContext.model as PrinterModel)
    ) {
      const model = workflowContext.model as PrinterModel;
      setHeaderPrinterModel(model);
      setDiagramModel(model);
      setSerialNumber(serialNumbers[model][0]);
    }
  }, [workflowContext.ticket, workflowContext.customer, workflowContext.model]);

  const inventorySummary = useMemo(() => {
    const available: SelectedPartLine[] = [];
    const lowStock: SelectedPartLine[] = [];
    const needingOrder: SelectedPartLine[] = [];

    for (const part of parts) {
      if (part.quantityNeeded <= 0) continue;

      const orderQty =
        part.orderQuantity > 0
          ? part.orderQuantity
          : getSuggestedOrderQuantity(part.quantityNeeded, part.inStock);

      if (part.inStock >= part.quantityNeeded) {
        available.push(part);
      } else if (part.inStock > 0) {
        lowStock.push(part);
      }

      if (orderQty > 0) {
        needingOrder.push(part);
      }
    }

    return { available, lowStock, needingOrder };
  }, [parts]);

  const orderSummary = useMemo(() => {
    const activeParts = parts.filter((part) => part.quantityNeeded > 0);
    const inStock = activeParts.filter(
      (part) => part.inStock >= part.quantityNeeded,
    );
    const toOrder = activeParts.filter((part) => {
      const orderQty =
        part.orderQuantity > 0
          ? part.orderQuantity
          : getSuggestedOrderQuantity(part.quantityNeeded, part.inStock);
      return orderQty > 0;
    });

    return {
      totalSelected: activeParts.length,
      inStockCount: inStock.length,
      toOrderCount: toOrder.length,
      inStock,
      toOrder,
    };
  }, [parts]);

  function handleHeaderModelChange(model: PrinterModel) {
    setHeaderPrinterModel(model);
    setSerialNumber(serialNumbers[model][0]);
  }

  function handleDiagramModelChange(model: PrinterModel) {
    setDiagramModel(model);
    setSelectedCallout(null);
    setSelectedPartName("");
  }

  function handleAssemblyChange(section: AssemblySection) {
    setAssembly(section);
    setSelectedCallout(null);
    setSelectedPartName("");
  }

  function handleCalloutChange(calloutNumber: string) {
    const callout = availableCallouts.find(
      (item) => item.calloutNumber === calloutNumber,
    );
    if (!callout) {
      setSelectedCallout(null);
      setSelectedPartName("");
      return;
    }

    setSelectedCallout(callout);
    setSelectedPartName(callout.partName);
  }

  function addPartFromDiagram() {
    if (!selectedCallout) return;

    const callout = selectedCallout;
    const alreadyExists = parts.some(
      (part) => part.partNumber === callout.partNumber,
    );
    if (alreadyExists) return;

    const quantityNeeded = 1;
    const orderQuantity = getSuggestedOrderQuantity(
      quantityNeeded,
      callout.inStock,
    );

    setParts((current) => [
      ...current,
      {
        id: `line-${Date.now()}`,
        calloutNumber: callout.calloutNumber,
        partNumber: callout.partNumber,
        description: callout.partName,
        quantityNeeded,
        inStock: callout.inStock,
        orderQuantity,
        reason: `Selected from ${assembly} diagram`,
      },
    ]);
  }

  function updatePart(id: string, updates: Partial<SelectedPartLine>) {
    setParts((current) =>
      current.map((part) => (part.id === id ? { ...part, ...updates } : part)),
    );
  }

  function removePart(id: string) {
    setParts((current) => current.filter((part) => part.id !== id));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    setExportNotice(false);
  }

  function handleExport() {
    setExportNotice(true);
    setSubmitted(false);
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
          Parts request captured locally. Database integration coming in a
          future release.
        </div>
      )}

      {exportNotice && (
        <div className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-6 py-4 text-cyan-200">
          Export order form is a placeholder. File export will be available in a
          future release.
        </div>
      )}

      <SectionCard
        title="Order Header"
        description="Service context and delivery details for this parts request."
      >
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm text-slate-400">
              Requester Name
            </label>
            <input
              type="text"
              value={requesterName}
              onChange={(e) => setRequesterName(e.target.value)}
              className={inputClassName}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-400">
              Request Date
            </label>
            <input
              type="date"
              value={requestDate}
              onChange={(e) => setRequestDate(e.target.value)}
              className={inputClassName}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-400">Customer</label>
            <select
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              className={inputClassName}
            >
              {customers.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-400">
              Service Call / Ticket #
            </label>
            <select
              value={ticketNumber}
              onChange={(e) => setTicketNumber(e.target.value)}
              className={inputClassName}
            >
              {serviceTickets.map((ticket) => (
                <option key={ticket} value={ticket}>
                  {ticket}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-400">
              Printer Model
            </label>
            <select
              value={headerPrinterModel}
              onChange={(e) =>
                handleHeaderModelChange(e.target.value as PrinterModel)
              }
              className={inputClassName}
            >
              {printerModels.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-400">
              Serial Number
            </label>
            <select
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              className={inputClassName}
            >
              {serialNumbers[headerPrinterModel].map((serial) => (
                <option key={serial} value={serial}>
                  {serial}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-400">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as OrderPriority)}
              className={inputClassName}
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
              Shipping Method
            </label>
            <select
              value={shippingMethod}
              onChange={(e) =>
                setShippingMethod(e.target.value as ShippingMethod)
              }
              className={inputClassName}
            >
              {shippingMethods.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2 lg:col-span-3">
            <label className="mb-2 block text-sm text-slate-400">
              Special Instructions
            </label>
            <textarea
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              rows={3}
              className={inputClassName}
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Guided Diagram Ordering"
        description="Select a printer model and assembly section, then pick a diagram callout to add parts."
      >
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-6">
            <div>
              <label className="mb-2 block text-sm text-slate-400">
                Printer Model
              </label>
              <select
                value={diagramModel}
                onChange={(e) =>
                  handleDiagramModelChange(e.target.value as PrinterModel)
                }
                className={inputClassName}
              >
                {printerModels.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-400">
                Assembly / Section
              </label>
              <select
                value={assembly}
                onChange={(e) =>
                  handleAssemblyChange(e.target.value as AssemblySection)
                }
                className={inputClassName}
              >
                {assemblySections.map((section) => (
                  <option key={section} value={section}>
                    {section}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-400">
                Diagram Callout Number
              </label>
              <select
                value={selectedCallout?.calloutNumber ?? ""}
                onChange={(e) => handleCalloutChange(e.target.value)}
                className={inputClassName}
              >
                <option value="">Select callout…</option>
                {availableCallouts.map((callout) => (
                  <option
                    key={callout.calloutNumber}
                    value={callout.calloutNumber}
                  >
                    #{callout.calloutNumber} — {callout.partName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-400">
                Part Name
              </label>
              <select
                value={selectedPartName}
                onChange={(e) => {
                  const callout = availableCallouts.find(
                    (item) => item.partName === e.target.value,
                  );
                  setSelectedPartName(e.target.value);
                  setSelectedCallout(callout ?? null);
                }}
                className={inputClassName}
              >
                <option value="">Select part…</option>
                {availableCallouts.map((callout) => (
                  <option key={callout.partNumber} value={callout.partName}>
                    {callout.partName}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={addPartFromDiagram}
              disabled={!selectedCallout}
              className="rounded-lg bg-cyan-500 px-5 py-2.5 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Add Part from Diagram
            </button>
          </div>

          <div className="flex min-h-[320px] flex-col rounded-xl border border-dashed border-slate-700 bg-slate-950/60 p-6">
            <h4 className="text-lg font-bold text-cyan-400">
              Printer Diagram Preview
            </h4>
            <div className="mt-6 flex flex-1 flex-col items-center justify-center rounded-lg border border-slate-800 bg-slate-900/80 px-6 text-center">
              <div className="mb-4 flex h-24 w-24 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-3xl text-slate-500">
                ◫
              </div>
              <p className="text-sm text-slate-400">
                Diagram image and numbered callouts will appear here.
              </p>
              {selectedCallout && (
                <div className="mt-6 w-full rounded-lg border border-cyan-500/30 bg-cyan-500/5 px-4 py-3 text-left text-sm">
                  <p className="font-semibold text-cyan-300">
                    Callout #{selectedCallout.calloutNumber}
                  </p>
                  <p className="mt-1 text-slate-300">
                    {selectedCallout.partName}
                  </p>
                  <p className="mt-1 font-mono text-xs text-slate-500">
                    {selectedCallout.partNumber}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Selected Parts Table"
        description="Review callout selections, quantities, and fulfillment reasons."
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-400">
              <tr>
                <th className="pb-3 font-medium">Callout #</th>
                <th className="pb-3 font-medium">Part #</th>
                <th className="pb-3 font-medium">Description</th>
                <th className="pb-3 font-medium">Quantity Needed</th>
                <th className="pb-3 font-medium">In Stock</th>
                <th className="pb-3 font-medium">Order Quantity</th>
                <th className="pb-3 font-medium">Reason</th>
                <th className="pb-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {parts.map((part) => (
                <tr key={part.id} className="border-t border-slate-800">
                  <td className="py-4 font-medium text-cyan-400">
                    {part.calloutNumber}
                  </td>
                  <td className="py-4 font-mono text-xs text-slate-300">
                    {part.partNumber}
                  </td>
                  <td className="py-4 text-white">{part.description}</td>
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
                  <td className="py-4 text-slate-300">{part.inStock}</td>
                  <td className="py-4">
                    <input
                      type="number"
                      min={0}
                      max={99}
                      value={
                        part.orderQuantity ||
                        getSuggestedOrderQuantity(
                          part.quantityNeeded,
                          part.inStock,
                        )
                      }
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
                    <input
                      type="text"
                      value={part.reason}
                      onChange={(e) =>
                        updatePart(part.id, { reason: e.target.value })
                      }
                      className="min-w-[180px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-white"
                    />
                  </td>
                  <td className="py-4">
                    <button
                      type="button"
                      onClick={() => removePart(part.id)}
                      className="text-xs text-rose-400 hover:text-rose-300"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        title="Inventory Check Panel"
        description="Live stock assessment for selected parts."
      >
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-5">
            <p className="text-sm font-semibold text-emerald-400">
              Parts Available
            </p>
            <p className="mt-2 text-3xl font-bold text-emerald-300">
              {inventorySummary.available.length}
            </p>
            <ul className="mt-4 space-y-2">
              {inventorySummary.available.length === 0 ? (
                <li className="text-sm text-slate-500">None.</li>
              ) : (
                inventorySummary.available.map((part) => (
                  <li
                    key={part.id}
                    className="rounded border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-200"
                  >
                    {part.description} — {part.inStock} in stock
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-5">
            <p className="text-sm font-semibold text-amber-400">
              Parts Low Stock
            </p>
            <p className="mt-2 text-3xl font-bold text-amber-300">
              {inventorySummary.lowStock.length}
            </p>
            <ul className="mt-4 space-y-2">
              {inventorySummary.lowStock.length === 0 ? (
                <li className="text-sm text-slate-500">None.</li>
              ) : (
                inventorySummary.lowStock.map((part) => (
                  <li
                    key={part.id}
                    className="rounded border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-amber-100"
                  >
                    {part.description} — {part.inStock} remaining
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-5">
            <p className="text-sm font-semibold text-rose-400">
              Parts Needing Order
            </p>
            <p className="mt-2 text-3xl font-bold text-rose-300">
              {inventorySummary.needingOrder.length}
            </p>
            <ul className="mt-4 space-y-2">
              {inventorySummary.needingOrder.length === 0 ? (
                <li className="text-sm text-slate-500">None.</li>
              ) : (
                inventorySummary.needingOrder.map((part) => (
                  <li
                    key={part.id}
                    className="rounded border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-rose-100"
                  >
                    {part.description} — order{" "}
                    {part.orderQuantity ||
                      getSuggestedOrderQuantity(
                        part.quantityNeeded,
                        part.inStock,
                      )}
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Order Summary"
        description="Final review before submitting the parts request."
      >
        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
            <p className="text-sm text-slate-400">Total Selected Parts</p>
            <p className="mt-2 text-3xl font-bold">
              {orderSummary.totalSelected}
            </p>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
            <p className="text-sm text-slate-400">Items Already in Stock</p>
            <p className="mt-2 text-3xl font-bold text-emerald-400">
              {orderSummary.inStockCount}
            </p>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
            <p className="text-sm text-slate-400">Items to Order</p>
            <p className="mt-2 text-3xl font-bold text-amber-400">
              {orderSummary.toOrderCount}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-800 pt-6">
          <div>
            <p className="text-sm text-slate-400">Priority</p>
            <p className={`mt-1 text-lg font-bold ${priorityStyles[priority]}`}>
              {priority}
            </p>
          </div>
          <div className="text-right text-sm text-slate-400">
            <p>{customer}</p>
            <p>{ticketNumber}</p>
            <p>{shippingMethod}</p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-4">
          <button
            type="submit"
            disabled={orderSummary.totalSelected === 0}
            className="rounded-xl bg-cyan-500 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Submit Parts Request
          </button>

          <button
            type="button"
            onClick={handleExport}
            className="rounded-xl border border-slate-600 px-6 py-3 font-semibold text-slate-200 transition hover:border-cyan-500 hover:text-cyan-300"
          >
            Export Order Form
          </button>
        </div>
      </SectionCard>

      <WorkflowPanel
        title="Workflow"
        description="Generate the parts order form and attach the request back to the service ticket."
        actions={workflowActions}
      />
    </form>
  );
}
