"use client";

import Link from "next/link";
import { useState } from "react";
import { getSampleWorkflowContext } from "@/lib/context/sample-context";
import {
  priorityStyles,
  SAMPLE_PARTS_ORDER_PREVIEW,
  sourceStyles,
} from "@/lib/parts-order-preview/data";
import { buildWorkflowUrl } from "@/lib/workflow/routes";

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

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-white">{value}</p>
    </div>
  );
}

function SignaturePlaceholder({ label }: { label: string }) {
  return (
    <div className="flex h-28 flex-col items-center justify-center rounded-lg border border-dashed border-slate-600 bg-slate-950/40 px-4">
      <p className="text-sm font-medium text-slate-400">{label}</p>
      <p className="mt-2 text-xs text-slate-600">Signature capture placeholder</p>
    </div>
  );
}

export default function PartsOrderPreviewForm() {
  const order = SAMPLE_PARTS_ORDER_PREVIEW;
  const workflowCtx = getSampleWorkflowContext();
  const [notice, setNotice] = useState("");

  const attachTicketHref = buildWorkflowUrl("/tickets", workflowCtx);
  const guidedDiagramHref = buildWorkflowUrl(
    "/guided-diagram-ordering",
    workflowCtx,
  );

  function showPlaceholder(action: string) {
    setNotice(
      `${action} is a placeholder. File export and send integration coming in a future release.`,
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/order-parts"
          className="text-sm text-cyan-400 hover:text-cyan-300"
        >
          ← Back to Order Parts
        </Link>
      </div>

      {notice && (
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 px-6 py-4 text-sm text-cyan-200">
          {notice}
        </div>
      )}

      <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 px-6 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
          Completed Order Form Preview
        </p>
        <p className="mt-2 text-sm text-slate-300">
          Review the generated parts order form before export or submission.
          All data is hardcoded sample content.
        </p>
      </div>

      <SectionCard
        title="Order Form Header"
        description="Request and shipping details for this parts order."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <InfoRow label="Requester Name" value={order.requesterName} />
          <InfoRow label="Request Date" value={order.requestDate} />
          <InfoRow label="PO Number" value={order.poNumber} />
          <InfoRow
            label="Customer / Service Call"
            value={order.customerServiceCall}
          />
          <InfoRow
            label="Ship-To Address"
            value={
              <span className="whitespace-pre-line">{order.shipToAddress}</span>
            }
          />
          <InfoRow label="Shipping Method" value={order.shippingMethod} />
          <InfoRow
            label="Priority"
            value={
              <span className={priorityStyles[order.priority]}>
                {order.priority}
              </span>
            }
          />
          <div className="sm:col-span-2 lg:col-span-4">
            <InfoRow
              label="Special Instructions"
              value={order.specialInstructions}
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Printer Information"
        description="Asset context for this parts order."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <InfoRow label="Printer Model" value={order.printerModel} />
          <InfoRow label="Serial Number" value={order.serialNumber} />
          <InfoRow label="Asset ID" value={order.assetId} />
          <InfoRow label="Location" value={order.location} />
          <InfoRow label="Related Ticket #" value={order.relatedTicket} />
        </div>
      </SectionCard>

      <SectionCard
        title="Parts Order Table"
        description={`${order.lines.length} line items on this order form.`}
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-400">
              <tr>
                <th className="pb-3 font-medium">Item #</th>
                <th className="pb-3 font-medium">Part #</th>
                <th className="pb-3 font-medium">Description</th>
                <th className="pb-3 font-medium">Quantity</th>
                <th className="pb-3 font-medium">Reason</th>
                <th className="pb-3 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {order.lines.map((line) => (
                <tr key={line.itemNumber} className="border-t border-slate-800">
                  <td className="py-4 font-medium text-cyan-400">
                    {line.itemNumber}
                  </td>
                  <td className="py-4 font-mono text-xs text-slate-300">
                    {line.partNumber}
                  </td>
                  <td className="py-4 text-white">{line.description}</td>
                  <td className="py-4 text-slate-300">{line.quantity}</td>
                  <td className="py-4 text-slate-400">{line.reason}</td>
                  <td className="py-4">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                        sourceStyles[line.source]
                      }`}
                    >
                      {line.source}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        title="Approval / Signature Section"
        description="Sign-off placeholders for technician, manager, and warehouse review."
      >
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <SignaturePlaceholder label="Technician Signature" />
          <SignaturePlaceholder label="Manager Approval" />
          <SignaturePlaceholder label="Warehouse Review" />
          <div className="flex h-28 flex-col justify-center rounded-lg border border-slate-800 bg-slate-950/60 px-4">
            <p className="text-xs text-slate-500">Date Submitted</p>
            <p className="mt-2 text-lg font-semibold text-white">
              {order.dateSubmitted}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Status: {order.technicianSignature}
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Actions"
        description="Export, submit, or return to the diagram ordering workflow."
      >
        <div className="flex flex-wrap gap-4">
          <button
            type="button"
            onClick={() => showPlaceholder("Export PDF")}
            className="rounded-xl border border-slate-600 px-6 py-3 font-semibold text-slate-200 transition hover:border-cyan-500 hover:text-cyan-300"
          >
            Export PDF
          </button>

          <button
            type="button"
            onClick={() => showPlaceholder("Export Excel")}
            className="rounded-xl border border-slate-600 px-6 py-3 font-semibold text-slate-200 transition hover:border-cyan-500 hover:text-cyan-300"
          >
            Export Excel
          </button>

          <button
            type="button"
            onClick={() => showPlaceholder("Send Order Request")}
            className="rounded-xl bg-cyan-500 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400"
          >
            Send Order Request
          </button>

          <Link
            href={attachTicketHref}
            className="rounded-xl border border-emerald-500/50 bg-emerald-500/10 px-6 py-3 font-semibold text-emerald-300 transition hover:bg-emerald-500/20"
          >
            Attach to Service Ticket
          </Link>

          <Link
            href={guidedDiagramHref}
            className="rounded-xl border border-cyan-500/50 bg-cyan-500/10 px-6 py-3 font-semibold text-cyan-300 transition hover:bg-cyan-500/20"
          >
            Back to Guided Diagram Ordering
          </Link>
        </div>
      </SectionCard>
    </div>
  );
}
