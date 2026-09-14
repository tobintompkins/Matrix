"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { getSampleWorkflowContext } from "@/lib/context/sample-context";
import {
  assetIds,
  assemblySections,
  createInitialCart,
  customers,
  getCalloutsForAssembly,
  getSuggestedOrderQuantity,
  inventoryStatusStyles,
  priorities,
  printerModels,
  serialNumbers,
  serviceTickets,
} from "@/lib/guided-diagram-ordering/data";
import type {
  AssemblySection,
  CartLine,
  DiagramCalloutRow,
  OrderPriority,
  PrinterModel,
} from "@/lib/guided-diagram-ordering/types";
import { buildWorkflowUrl } from "@/lib/workflow/routes";
import {
  createPurchaseRequest,
  lookupGuidedDiagramPart,
} from "@/lib/inventory";

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

const MIN_ZOOM = 75;
const MAX_ZOOM = 150;

export default function GuidedDiagramOrderingForm() {
  const workflowCtx = getSampleWorkflowContext();

  const [customer, setCustomer] = useState(customers[0]);
  const [printerModel, setPrinterModel] = useState<PrinterModel>("GD9630");
  const [assetId, setAssetId] = useState(assetIds.GD9630[0]);
  const [serialNumber, setSerialNumber] = useState(serialNumbers.GD9630[0]);
  const [serviceTicket, setServiceTicket] = useState(serviceTickets[0]);
  const [priority, setPriority] = useState<OrderPriority>("High");

  const [assembly, setAssembly] = useState<AssemblySection>("Feed Unit");
  const [selectedCalloutNumber, setSelectedCalloutNumber] = useState("");
  const [zoom, setZoom] = useState(100);
  const [showCalloutList, setShowCalloutList] = useState(true);

  const [cart, setCart] = useState<CartLine[]>(createInitialCart);
  const [actionNotice, setActionNotice] = useState("");

  const callouts = getCalloutsForAssembly(printerModel, assembly);

  const selectedCallout = useMemo(
    () => callouts.find((row) => row.calloutNumber === selectedCalloutNumber),
    [callouts, selectedCalloutNumber],
  );

  const enterprisePart = useMemo(() => {
    if (!selectedCallout) return null;
    return lookupGuidedDiagramPart({
      printerModel,
      assembly,
      calloutNumber: selectedCallout.calloutNumber,
      partNumber: selectedCallout.partNumber,
      truckLocationId: "loc-truck-alex",
    });
  }, [selectedCallout, printerModel, assembly]);

  function handleModelChange(model: PrinterModel) {
    setPrinterModel(model);
    setAssetId(assetIds[model][0]);
    setSerialNumber(serialNumbers[model][0]);
    setSelectedCalloutNumber("");
  }

  function handleAssemblyChange(section: AssemblySection) {
    setAssembly(section);
    setSelectedCalloutNumber("");
  }

  function addSelectedPart() {
    if (!selectedCallout) {
      setActionNotice("Select a callout before adding to cart.");
      return;
    }

    const exists = cart.some(
      (line) => line.partNumber === selectedCallout.partNumber,
    );
    if (exists) {
      setActionNotice(`${selectedCallout.partName} is already in the cart.`);
      return;
    }

    const quantityNeeded = selectedCallout.quantity;
    const orderQuantity = getSuggestedOrderQuantity(
      quantityNeeded,
      selectedCallout.inStock,
    );

    setCart((current) => [
      ...current,
      {
        id: `cart-${Date.now()}`,
        calloutNumber: selectedCallout.calloutNumber,
        partNumber: selectedCallout.partNumber,
        partName: selectedCallout.partName,
        quantityNeeded,
        inStock: selectedCallout.inStock,
        orderQuantity,
        reason: `Callout #${selectedCallout.calloutNumber} — ${assembly}`,
      },
    ]);
    setActionNotice(`${selectedCallout.partName} added to cart.`);
  }

  function updateCartLine(id: string, updates: Partial<CartLine>) {
    setCart((current) =>
      current.map((line) => (line.id === id ? { ...line, ...updates } : line)),
    );
  }

  function removeCartLine(id: string) {
    setCart((current) => current.filter((line) => line.id !== id));
  }

  function addToPurchaseRequest() {
    if (!enterprisePart) {
      setActionNotice("No enterprise catalog match for this callout yet.");
      return;
    }
    const result = createPurchaseRequest({
      requester: "Alex Rivera",
      priority: priority === "Critical" ? "CRITICAL" : priority === "High" ? "HIGH" : "NORMAL",
      vendorId: null,
      justification: `Guided diagram ${printerModel} / ${assembly} callout #${selectedCalloutNumber}`,
      lines: [
        {
          partId: enterprisePart.partId,
          partNumber: enterprisePart.partNumber,
          description: enterprisePart.description,
          quantity: selectedCallout?.quantity ?? 1,
          unitCost: 0,
        },
      ],
    });
    setActionNotice(
      result.ok
        ? `Added to purchase request ${result.request?.requestNumber}`
        : result.error ?? "Could not create purchase request",
    );
  }

  const partsOrderBuilderHref = buildWorkflowUrl("/parts-order-builder", {
    ...workflowCtx,
    customer,
    assetId,
    model: printerModel,
    ticket: serviceTicket,
    from: "parts-order-builder",
  });

  const attachTicketHref = buildWorkflowUrl("/tickets", {
    ...workflowCtx,
    customer,
    assetId,
    model: printerModel,
    ticket: serviceTicket,
  });

  const inventoryHref = buildWorkflowUrl("/inventory", {
    ...workflowCtx,
    customer,
    assetId,
    model: printerModel,
    ticket: serviceTicket,
  });

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/dashboard"
          className="text-sm text-cyan-400 hover:text-cyan-300"
        >
          ← Back to Service Hub
        </Link>
      </div>

      {actionNotice && (
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 px-6 py-4 text-sm text-cyan-200">
          {actionNotice}
        </div>
      )}

      <SectionCard
        title="Diagram Search Header"
        description="Locate the printer assembly diagram for guided parts selection."
      >
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
              Printer Model
            </label>
            <select
              value={printerModel}
              onChange={(e) =>
                handleModelChange(e.target.value as PrinterModel)
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
            <label className="mb-2 block text-sm text-slate-400">Asset ID</label>
            <select
              value={assetId}
              onChange={(e) => setAssetId(e.target.value)}
              className={inputClassName}
            >
              {assetIds[printerModel].map((id) => (
                <option key={id} value={id}>
                  {id}
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
              {serialNumbers[printerModel].map((serial) => (
                <option key={serial} value={serial}>
                  {serial}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-400">
              Service Ticket #
            </label>
            <select
              value={serviceTicket}
              onChange={(e) => setServiceTicket(e.target.value)}
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
        </div>
      </SectionCard>

      <SectionCard
        title="Model / Assembly Selector"
        description="Choose the printer model and assembly section to load diagram callouts."
      >
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm text-slate-400">
              Printer Model
            </label>
            <select
              value={printerModel}
              onChange={(e) =>
                handleModelChange(e.target.value as PrinterModel)
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
        </div>
      </SectionCard>

      <div className="grid gap-8 xl:grid-cols-2">
        <SectionCard
          title="Printer Assembly Diagram"
          description={`${printerModel} — ${assembly} (placeholder view)`}
        >
          <div className="mb-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + 10))}
              className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
            >
              Zoom In
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - 10))}
              className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
            >
              Zoom Out
            </button>
            <button
              type="button"
              onClick={() => setZoom(100)}
              className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
            >
              Reset View
            </button>
            <button
              type="button"
              onClick={() => setShowCalloutList((v) => !v)}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                showCalloutList
                  ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-300"
                  : "border-slate-600 text-slate-200 hover:bg-slate-800"
              }`}
            >
              {showCalloutList ? "Hide Callout List" : "Show Callout List"}
            </button>
            <span className="flex items-center text-sm text-slate-500">
              {zoom}%
            </span>
          </div>

          <div className="flex min-h-[420px] items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-700 bg-slate-950/60 p-6">
            <div
              className="flex w-full flex-col items-center justify-center text-center transition-transform duration-200"
              style={{ transform: `scale(${zoom / 100})` }}
            >
              <div className="relative mb-6 flex h-56 w-full max-w-md items-center justify-center rounded-lg border border-slate-800 bg-slate-900">
                <div className="absolute inset-4 rounded border border-slate-700/80" />
                {callouts.map((callout, index) => (
                  <button
                    key={callout.calloutNumber}
                    type="button"
                    onClick={() =>
                      setSelectedCalloutNumber(callout.calloutNumber)
                    }
                    className={`absolute flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold transition ${
                      selectedCalloutNumber === callout.calloutNumber
                        ? "border-cyan-400 bg-cyan-500 text-slate-950"
                        : "border-slate-600 bg-slate-800 text-cyan-300 hover:border-cyan-500"
                    }`}
                    style={{
                      top: `${20 + index * 18}%`,
                      left: `${25 + index * 12}%`,
                    }}
                    title={`#${callout.calloutNumber} ${callout.partName}`}
                  >
                    {callout.calloutNumber}
                  </button>
                ))}
                <span className="text-6xl text-slate-700" aria-hidden>
                  ◫
                </span>
              </div>
              <p className="max-w-md text-sm text-slate-400">
                Diagram image with numbered callouts will display here.
              </p>
              {selectedCallout && (
                <p className="mt-3 text-sm font-medium text-cyan-300">
                  Selected: #{selectedCallout.calloutNumber} —{" "}
                  {selectedCallout.partName}
                </p>
              )}
            </div>
          </div>
        </SectionCard>

        {showCalloutList && (
          <SectionCard
            title="Callout Selection"
            description="Select a numbered callout to review part details and inventory status."
          >
            <div className="mb-4">
              <label className="mb-2 block text-sm text-slate-400">
                Callout #
              </label>
              <select
                value={selectedCalloutNumber}
                onChange={(e) => setSelectedCalloutNumber(e.target.value)}
                className={inputClassName}
              >
                <option value="">Select callout…</option>
                {callouts.map((row) => (
                  <option key={row.calloutNumber} value={row.calloutNumber}>
                    #{row.calloutNumber} — {row.partName}
                  </option>
                ))}
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-slate-400">
                  <tr>
                    <th className="pb-3 font-medium">Callout #</th>
                    <th className="pb-3 font-medium">Part #</th>
                    <th className="pb-3 font-medium">Part Name</th>
                    <th className="pb-3 font-medium">Description</th>
                    <th className="pb-3 font-medium">Qty</th>
                    <th className="pb-3 font-medium">Model</th>
                    <th className="pb-3 font-medium">Inventory</th>
                  </tr>
                </thead>
                <tbody>
                  {callouts.map((row: DiagramCalloutRow) => (
                    <tr
                      key={row.calloutNumber}
                      onClick={() => setSelectedCalloutNumber(row.calloutNumber)}
                      className={`cursor-pointer border-t border-slate-800 ${
                        selectedCalloutNumber === row.calloutNumber
                          ? "bg-cyan-500/5"
                          : "hover:bg-slate-950/60"
                      }`}
                    >
                      <td className="py-3 font-medium text-cyan-400">
                        {row.calloutNumber}
                      </td>
                      <td className="py-3 font-mono text-xs text-slate-300">
                        {row.partNumber}
                      </td>
                      <td className="py-3 text-white">{row.partName}</td>
                      <td className="py-3 text-slate-400">{row.description}</td>
                      <td className="py-3 text-slate-300">{row.quantity}</td>
                      <td className="py-3 text-slate-300">{row.compatibleModel}</td>
                      <td className="py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                            inventoryStatusStyles[row.inventoryStatus]
                          }`}
                        >
                          {row.inventoryStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        )}
      </div>

      <SectionCard
        title="Selected Parts Cart"
        description="Parts chosen from diagram callouts for this service request."
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-400">
              <tr>
                <th className="pb-3 font-medium">Callout #</th>
                <th className="pb-3 font-medium">Part #</th>
                <th className="pb-3 font-medium">Part Name</th>
                <th className="pb-3 font-medium">Qty Needed</th>
                <th className="pb-3 font-medium">In Stock</th>
                <th className="pb-3 font-medium">Order Qty</th>
                <th className="pb-3 font-medium">Reason</th>
                <th className="pb-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {cart.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No parts in cart. Select a callout and click Add Selected
                    Part.
                  </td>
                </tr>
              ) : (
                cart.map((line) => (
                  <tr key={line.id} className="border-t border-slate-800">
                    <td className="py-4 font-medium text-cyan-400">
                      {line.calloutNumber}
                    </td>
                    <td className="py-4 font-mono text-xs text-slate-300">
                      {line.partNumber}
                    </td>
                    <td className="py-4 text-white">{line.partName}</td>
                    <td className="py-4">
                      <input
                        type="number"
                        min={0}
                        max={99}
                        value={line.quantityNeeded}
                        onChange={(e) =>
                          updateCartLine(line.id, {
                            quantityNeeded: Math.max(
                              0,
                              Number(e.target.value) || 0,
                            ),
                          })
                        }
                        className="w-20 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-white"
                      />
                    </td>
                    <td className="py-4 text-slate-300">{line.inStock}</td>
                    <td className="py-4">
                      <input
                        type="number"
                        min={0}
                        max={99}
                        value={
                          line.orderQuantity ||
                          getSuggestedOrderQuantity(
                            line.quantityNeeded,
                            line.inStock,
                          )
                        }
                        onChange={(e) =>
                          updateCartLine(line.id, {
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
                        value={line.reason}
                        onChange={(e) =>
                          updateCartLine(line.id, { reason: e.target.value })
                        }
                        className="min-w-[180px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-white"
                      />
                    </td>
                    <td className="py-4">
                      <button
                        type="button"
                        onClick={() => removeCartLine(line.id)}
                        className="text-xs text-rose-400 hover:text-rose-300"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {selectedCallout && (
        <SectionCard
          title="Parts availability"
          description="Model → Assembly → Diagram → Callout populates catalog and live availability."
        >
          {enterprisePart ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 text-sm">
              <div>
                <p className="text-slate-500">Part Number</p>
                <p className="font-mono text-cyan-300">{enterprisePart.partNumber}</p>
              </div>
              <div>
                <p className="text-slate-500">Description</p>
                <p className="text-white">{enterprisePart.description}</p>
              </div>
              <div>
                <p className="text-slate-500">Compatible Models</p>
                <p className="text-slate-200">
                  {enterprisePart.compatibleModels.join(", ")}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Warehouse Qty (available)</p>
                <p className="text-white">{enterprisePart.warehouseQuantity}</p>
              </div>
              <div>
                <p className="text-slate-500">Truck Qty (available)</p>
                <p className="text-white">{enterprisePart.truckQuantity}</p>
              </div>
              <div>
                <p className="text-slate-500">Vendor</p>
                <p className="text-slate-200">{enterprisePart.vendorAvailability}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              No enterprise catalog match for this callout. Cart and order builder
              still work with diagram data.
            </p>
          )}
        </SectionCard>
      )}

      <SectionCard title="Actions" description="Continue the parts ordering workflow.">
        <div className="flex flex-wrap gap-4">
          <button
            type="button"
            onClick={addSelectedPart}
            className="rounded-xl bg-cyan-500 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400"
          >
            Add to Shopping Cart
          </button>

          <button
            type="button"
            onClick={addToPurchaseRequest}
            className="rounded-xl border border-cyan-500/50 bg-cyan-500/10 px-6 py-3 font-semibold text-cyan-300 transition hover:bg-cyan-500/20"
          >
            Add to Parts Request
          </button>

          <Link
            href="/work-orders/new"
            className="rounded-xl border border-slate-600 px-6 py-3 font-semibold text-slate-200 transition hover:border-cyan-500 hover:text-cyan-300"
          >
            Add to Work Order
          </Link>

          <Link
            href="/start-pm"
            className="rounded-xl border border-slate-600 px-6 py-3 font-semibold text-slate-200 transition hover:border-cyan-500 hover:text-cyan-300"
          >
            Add to PM Checklist
          </Link>

          <Link
            href={inventoryHref}
            className="rounded-xl border border-slate-600 px-6 py-3 font-semibold text-slate-200 transition hover:border-cyan-500 hover:text-cyan-300"
          >
            Check Inventory
          </Link>

          <Link
            href={partsOrderBuilderHref}
            className="rounded-xl border border-cyan-500/50 bg-cyan-500/10 px-6 py-3 font-semibold text-cyan-300 transition hover:bg-cyan-500/20"
          >
            Send to Parts Order Builder
          </Link>

          <Link
            href={attachTicketHref}
            className="rounded-xl border border-emerald-500/50 bg-emerald-500/10 px-6 py-3 font-semibold text-emerald-300 transition hover:bg-emerald-500/20"
          >
            Attach to Service Ticket
          </Link>
        </div>

        <p className="mt-4 text-xs text-slate-500">
          Availability uses the inventory catalog. Diagram images and live
          database persistence continue in future releases.
        </p>
      </SectionCard>
    </div>
  );
}
