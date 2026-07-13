"use client";

import Link from "next/link";
import { useState } from "react";
import { getSampleWorkflowContext } from "@/lib/context/sample-context";
import {
  SAMPLE_DIAGRAM_PART_DETAIL,
  statusStyles,
} from "@/lib/diagram-part-detail/data";
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

export default function DiagramPartDetailPanel() {
  const part = SAMPLE_DIAGRAM_PART_DETAIL;
  const workflowCtx = getSampleWorkflowContext();
  const [zoom, setZoom] = useState(100);
  const [notice, setNotice] = useState("");

  const partsOrderHref = buildWorkflowUrl("/parts-order-builder", workflowCtx);
  const pmKitHref = buildWorkflowUrl("/request-pm-kit", workflowCtx);
  const ticketHref = buildWorkflowUrl("/tickets", workflowCtx);
  const guidedDiagramHref = buildWorkflowUrl(
    "/guided-diagram-ordering",
    workflowCtx,
  );
  const diagramLibraryHref = buildWorkflowUrl(
    "/diagram-library",
    workflowCtx,
  );

  function showPlaceholder(action: string) {
    setNotice(
      `${action} is a placeholder. Real ordering integration coming in a future release.`,
    );
  }

  return (
    <div className="space-y-8">
      {notice && (
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 px-6 py-4 text-sm text-cyan-200">
          {notice}
        </div>
      )}

      <SectionCard
        title="Part Header"
        description="Selected diagram callout and part identification."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <InfoRow label="Part Name" value={part.partName} />
          <InfoRow
            label="Part #"
            value={<span className="font-mono text-cyan-400">{part.partNumber}</span>}
          />
          <InfoRow label="Compatible Model" value={part.compatibleModel} />
          <InfoRow label="Assembly / Section" value={part.assembly} />
          <InfoRow
            label="Diagram Callout #"
            value={
              <span className="text-lg font-bold text-cyan-300">
                {part.calloutNumber}
              </span>
            }
          />
          <InfoRow
            label="Status"
            value={
              <span className={statusStyles[part.status]}>{part.status}</span>
            }
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Visual Reference"
        description={`From diagram: ${part.diagramName}`}
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60">
            <div className="border-b border-slate-800 px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
              Assembly Diagram Preview
            </div>
            <div
              className="flex h-64 items-center justify-center transition-transform duration-200"
              style={{ transform: `scale(${zoom / 100})` }}
            >
              <div className="text-center">
                <span className="text-6xl text-slate-700" aria-hidden>
                  ◫
                </span>
                <p className="mt-3 text-sm text-slate-500">
                  {part.assembly} — Callout {part.calloutNumber}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Diagram placeholder
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60">
            <div className="border-b border-slate-800 px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
              Part Image Preview
            </div>
            <div className="flex h-64 items-center justify-center">
              <div className="text-center">
                <span className="text-6xl text-slate-700" aria-hidden>
                  ▣
                </span>
                <p className="mt-3 text-sm font-medium text-white">
                  {part.partName}
                </p>
                <p className="mt-1 font-mono text-xs text-cyan-400">
                  {part.partNumber}
                </p>
                <p className="mt-1 text-xs text-slate-600">Part image placeholder</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(50, z - 25))}
              className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
            >
              −
            </button>
            <span className="min-w-[4rem] text-center text-sm text-slate-400">
              {zoom}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(200, z + 25))}
              className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
            >
              +
            </button>
            <span className="text-sm text-slate-500">Zoom Diagram</span>
          </div>

          <button
            type="button"
            onClick={() => showPlaceholder("View Full Diagram")}
            className="rounded-lg border border-cyan-500/50 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-300 hover:bg-cyan-500/20"
          >
            View Full Diagram
          </button>

          <Link
            href={diagramLibraryHref}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
          >
            Open Diagram Library
          </Link>
        </div>
      </SectionCard>

      <SectionCard
        title="Part Details"
        description="Technical reference and replacement context."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <InfoRow label="Description" value={part.description} />
          </div>
          <InfoRow
            label="Quantity normally required"
            value={part.quantityNormallyRequired}
          />
          <InfoRow
            label="Compatible models"
            value={part.compatibleModels.join(", ")}
          />
          <InfoRow label="Related PM kit" value={part.relatedPmKit} />
          <InfoRow
            label="Common replacement reason"
            value={part.commonReplacementReason}
          />
          <div className="sm:col-span-2">
            <InfoRow label="Notes" value={part.notes} />
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Inventory Status"
        description="Current stock position for this part."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <InfoRow
            label="Current stock"
            value={
              <span className="text-lg font-bold text-emerald-400">
                {part.inventory.currentStock}
              </span>
            }
          />
          <InfoRow
            label="Reorder level"
            value={part.inventory.reorderLevel}
          />
          <InfoRow label="On order" value={part.inventory.onOrder} />
          <InfoRow
            label="Need to order quantity"
            value={
              <span
                className={
                  part.inventory.needToOrderQuantity > 0
                    ? "text-rose-400"
                    : "text-slate-300"
                }
              >
                {part.inventory.needToOrderQuantity}
              </span>
            }
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Actions"
        description="Add this part to workflows or return to the diagram library."
      >
        <div className="flex flex-wrap gap-4">
          <button
            type="button"
            onClick={() => showPlaceholder("Add to Parts Order")}
            className="rounded-xl bg-cyan-500 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400"
          >
            Add to Parts Order
          </button>
          <Link
            href={pmKitHref}
            className="rounded-xl border border-cyan-500/50 bg-cyan-500/10 px-6 py-3 font-semibold text-cyan-300 transition hover:bg-cyan-500/20"
          >
            Add to PM Kit Request
          </Link>
          <Link
            href={ticketHref}
            className="rounded-xl border border-slate-600 px-6 py-3 font-semibold text-slate-200 transition hover:border-cyan-500 hover:text-cyan-300"
          >
            Attach to Service Ticket
          </Link>
          <Link
            href={guidedDiagramHref}
            className="rounded-xl border border-slate-600 px-6 py-3 font-semibold text-slate-200 transition hover:border-cyan-500 hover:text-cyan-300"
          >
            Open Guided Diagram Ordering
          </Link>
          <Link
            href={diagramLibraryHref}
            className="rounded-xl border border-slate-600 px-6 py-3 font-semibold text-slate-200 transition hover:bg-slate-800"
          >
            Back to Diagram Library
          </Link>
        </div>
        <p className="mt-4 text-xs text-slate-500">
          Part images, database lookup, and live ordering integration coming in
          future releases.
        </p>
      </SectionCard>
    </div>
  );
}
