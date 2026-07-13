"use client";

import { useMemo, useState } from "react";
import {
  MatrixButton,
  MatrixCard,
  MatrixEmptyState,
  MatrixStatusBadge,
  type MatrixStatusVariant,
} from "@/app/components/ui";
import {
  mockScanValues,
  SCANNER_INTEGRATION_PLACEHOLDERS,
} from "@/lib/scanner/data";
import {
  createHistoryItem,
  detectLookupType,
  lookupScanValue,
  partResultToOrderDraft,
} from "@/lib/scanner/helpers";
import type {
  ScanLookupResult,
  ScannerHistoryItem,
} from "@/lib/scanner/types";

function inventoryVariant(
  status: string,
): MatrixStatusVariant {
  if (status === "In Stock") return "completed";
  if (status === "Low Stock") return "warning";
  if (status === "Out of Stock") return "error";
  return "offline";
}

function inventoryClassName(status: string): string {
  if (status === "In Stock") {
    return "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30";
  }
  if (status === "Low Stock") {
    return "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30";
  }
  if (status === "Out of Stock") {
    return "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30";
  }
  return "";
}

type OrderDraftLine = ReturnType<typeof partResultToOrderDraft>;

export default function ScannerPanel() {
  const [query, setQuery] = useState("");
  const [lookup, setLookup] = useState<ScanLookupResult | null>(null);
  const [history, setHistory] = useState<ScannerHistoryItem[]>([]);
  const [orderDraft, setOrderDraft] = useState<OrderDraftLine[]>([]);
  const [mockIndex, setMockIndex] = useState(0);
  const [notice, setNotice] = useState("");

  const detectedPreview = useMemo(
    () => (query.trim() ? detectLookupType(query) : null),
    [query],
  );

  function runLookup(value: string) {
    const result = lookupScanValue(value);
    setLookup(result);
    setHistory((current) => [createHistoryItem(result), ...current].slice(0, 12));
    if (!result.found) {
      setNotice("");
    }
  }

  function handleLookup() {
    if (!query.trim()) {
      setLookup({
        found: false,
        query: "",
        detectedType: "unknown",
        message: "Enter a barcode, QR value, part number, asset ID, or serial.",
      });
      return;
    }
    runLookup(query);
  }

  function handleMockScan() {
    const value = mockScanValues[mockIndex % mockScanValues.length];
    setMockIndex((i) => i + 1);
    setQuery(value);
    runLookup(value);
    setNotice(`Mock scan returned: ${value}`);
  }

  function handleClear() {
    setQuery("");
    setLookup(null);
    setNotice("");
  }

  function handleAddToOrder() {
    if (!lookup?.found || lookup.result.kind !== "part") {
      if (lookup?.found && lookup.result.kind === "diagram-callout") {
        const synthetic = {
          kind: "part" as const,
          partNumber: lookup.result.partNumber,
          description: lookup.result.partName,
          compatibleModels: [lookup.result.model],
          inventoryStatus: "Low Stock" as const,
          quantityOnHand: 0,
          locationLabel: "From diagram callout",
          locationType: "warehouse" as const,
        };
        const line = partResultToOrderDraft(synthetic);
        setOrderDraft((current) => [line, ...current]);
        setNotice(
          `Added ${line.partNumber} to Parts Order Draft (qty ${line.quantity}).`,
        );
        return;
      }
      setNotice("Only part (or diagram callout) results can be added to a parts order draft.");
      return;
    }
    const line = partResultToOrderDraft(lookup.result);
    setOrderDraft((current) => [line, ...current]);
    setNotice(
      `Added ${line.partNumber} to Parts Order Draft (qty ${line.quantity}).`,
    );
  }

  function replayHistory(item: ScannerHistoryItem) {
    setQuery(item.query);
    runLookup(item.query);
  }

  return (
    <div className="space-y-6">
      {notice && (
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 px-4 py-3 text-sm text-cyan-200 sm:px-6">
          {notice}
        </div>
      )}

      <MatrixCard
        title="Scan / Lookup"
        subtitle="Enter a barcode or QR value, or use Mock Scan for sample results."
      >
        <div className="space-y-4">
          <label htmlFor="scanner-input" className="sr-only">
            Barcode or QR value
          </label>
          <input
            id="scanner-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLookup()}
            placeholder="Scan or type part #, asset ID, serial, or callout…"
            className="w-full rounded-xl border border-slate-600 bg-slate-950 px-4 py-4 text-lg text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 sm:px-5 sm:py-5 sm:text-xl"
            autoComplete="off"
            autoCapitalize="characters"
          />

          {detectedPreview && (
            <p className="text-sm text-slate-400">
              Detected type:{" "}
              <span className="font-medium text-cyan-300">{detectedPreview}</span>
            </p>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <MatrixButton
              type="button"
              variant="primary"
              size="lg"
              onClick={handleLookup}
              className="w-full sm:w-auto min-h-12"
            >
              Lookup
            </MatrixButton>
            <MatrixButton
              type="button"
              variant="success"
              size="lg"
              onClick={handleMockScan}
              className="w-full sm:w-auto min-h-12"
            >
              Mock Scan
            </MatrixButton>
            <MatrixButton
              type="button"
              variant="secondary"
              size="lg"
              onClick={handleClear}
              className="w-full sm:w-auto min-h-12"
            >
              Clear Lookup
            </MatrixButton>
            <MatrixButton
              href="/dashboard"
              variant="secondary"
              size="lg"
              className="w-full sm:w-auto min-h-12"
            >
              Back to Dashboard
            </MatrixButton>
          </div>

          <p className="text-xs text-slate-500">
            Try: RIS-GD-FR-2201 · MX-GD-002 · GD9630-SN-88421 · GD9630-FU-12 ·
            UNKNOWN-CODE
          </p>
        </div>
      </MatrixCard>

      {lookup && !lookup.found && (
        <MatrixEmptyState
          title="Not found"
          description={lookup.message}
          actionLabel="Clear Lookup"
          onAction={handleClear}
        />
      )}

      {lookup?.found && lookup.result.kind === "part" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <MatrixCard title="Part Lookup Result">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs text-slate-500">Part number</dt>
                <dd className="mt-1 font-mono text-lg font-semibold text-cyan-400">
                  {lookup.result.partNumber}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Description</dt>
                <dd className="mt-1 text-base text-white">
                  {lookup.result.description}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Compatible models</dt>
                <dd className="mt-1 text-slate-200">
                  {lookup.result.compatibleModels.join(", ")}
                </dd>
              </div>
            </dl>
          </MatrixCard>

          <MatrixCard title="Inventory Status">
            <div className="space-y-3">
              <MatrixStatusBadge
                variant={inventoryVariant(lookup.result.inventoryStatus)}
                label={lookup.result.inventoryStatus}
                className={inventoryClassName(lookup.result.inventoryStatus)}
              />
              <p className="text-3xl font-bold text-white">
                {lookup.result.quantityOnHand}
                <span className="ml-2 text-sm font-normal text-slate-400">
                  on hand
                </span>
              </p>
              <p className="text-sm text-slate-400">
                {lookup.result.locationType} · {lookup.result.locationLabel}
              </p>
              {lookup.result.lastServiceNote && (
                <p className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-300">
                  {lookup.result.lastServiceNote}
                </p>
              )}
            </div>
          </MatrixCard>

          {(lookup.result.diagramName || lookup.result.calloutNumber) && (
            <MatrixCard title="Diagram Shortcut">
              <p className="text-white">{lookup.result.diagramName}</p>
              {lookup.result.calloutNumber && (
                <p className="mt-2 text-sm text-slate-400">
                  Callout #{lookup.result.calloutNumber}
                </p>
              )}
            </MatrixCard>
          )}

          <MatrixCard title="Parts Order Shortcut">
            <p className="mb-4 text-sm text-slate-400">
              Add this part to a local Parts Order Draft, then continue in Parts
              Order Builder.
            </p>
            <MatrixButton
              type="button"
              variant="primary"
              size="md"
              onClick={handleAddToOrder}
            >
              Add to Parts Order
            </MatrixButton>
          </MatrixCard>
        </div>
      )}

      {lookup?.found && lookup.result.kind === "printer" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <MatrixCard title="Printer Lookup Result">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-slate-500">Asset ID</dt>
                <dd className="mt-1 font-mono text-lg font-semibold text-cyan-400">
                  {lookup.result.assetId}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Model</dt>
                <dd className="mt-1 text-lg font-semibold text-white">
                  {lookup.result.model}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Serial number</dt>
                <dd className="mt-1 font-mono text-slate-200">
                  {lookup.result.serialNumber}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Status</dt>
                <dd className="mt-1 text-slate-200">{lookup.result.status}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-slate-500">Location</dt>
                <dd className="mt-1 text-slate-200">{lookup.result.location}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Customer</dt>
                <dd className="mt-1 text-slate-200">{lookup.result.customer}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Last service</dt>
                <dd className="mt-1 text-slate-200">
                  {lookup.result.lastServiceDate}
                </dd>
              </div>
            </dl>
          </MatrixCard>

          <MatrixCard title="Service History Shortcut">
            <p className="text-3xl font-bold text-white">
              {lookup.result.openTicketCount}
              <span className="ml-2 text-sm font-normal text-slate-400">
                open ticket(s)
              </span>
            </p>
            <p className="mt-3 text-sm text-slate-400">
              Open Digital Twin for this asset, or jump to service tickets.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <MatrixButton
                href={`/digital-twin/${lookup.result.assetId}`}
                variant="primary"
                size="md"
              >
                Open Digital Twin
              </MatrixButton>
              <MatrixButton href="/tickets" variant="secondary" size="md">
                View Service History
              </MatrixButton>
            </div>
          </MatrixCard>
        </div>
      )}

      {lookup?.found && lookup.result.kind === "diagram-callout" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <MatrixCard title="Diagram Callout Result">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs text-slate-500">Callout code</dt>
                <dd className="mt-1 font-mono text-lg font-semibold text-cyan-400">
                  {lookup.result.calloutCode}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Diagram</dt>
                <dd className="mt-1 text-white">{lookup.result.diagramName}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Model / Assembly</dt>
                <dd className="mt-1 text-slate-200">
                  {lookup.result.model} · {lookup.result.assembly}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Part</dt>
                <dd className="mt-1 font-mono text-cyan-300">
                  {lookup.result.partNumber}
                </dd>
                <dd className="mt-1 text-slate-200">{lookup.result.partName}</dd>
              </div>
            </dl>
          </MatrixCard>

          <MatrixCard title="Diagram Shortcut">
            <p className="mb-4 text-sm text-slate-400">
              Open Guided Diagram Ordering for this callout, or add the linked
              part to a draft order.
            </p>
            <div className="flex flex-wrap gap-2">
              <MatrixButton
                href="/guided-diagram-ordering"
                variant="primary"
                size="md"
              >
                Open Diagram
              </MatrixButton>
              <MatrixButton
                type="button"
                variant="secondary"
                size="md"
                onClick={handleAddToOrder}
              >
                Add to Parts Order
              </MatrixButton>
            </div>
          </MatrixCard>
        </div>
      )}

      {lookup?.found && (
        <MatrixCard title="Quick Actions">
          <div className="flex flex-wrap gap-3">
            {lookup.actions.map((action) => {
              if (action.id === "add-to-parts-order") {
                return (
                  <MatrixButton
                    key={action.id}
                    type="button"
                    variant={action.variant ?? "secondary"}
                    size="md"
                    onClick={handleAddToOrder}
                  >
                    {action.label}
                  </MatrixButton>
                );
              }
              if (action.id === "clear-lookup") {
                return (
                  <MatrixButton
                    key={action.id}
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={handleClear}
                  >
                    {action.label}
                  </MatrixButton>
                );
              }
              return (
                <MatrixButton
                  key={action.id}
                  href={action.href}
                  variant={action.variant ?? "secondary"}
                  size="md"
                >
                  {action.label}
                </MatrixButton>
              );
            })}
            <MatrixButton
              type="button"
              variant="secondary"
              size="md"
              onClick={handleClear}
            >
              Clear Lookup
            </MatrixButton>
            <MatrixButton href="/dashboard" variant="secondary" size="md">
              Back to Dashboard
            </MatrixButton>
          </div>
        </MatrixCard>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <MatrixCard
          title="Recent Scans"
          subtitle={`${history.length} lookup(s) in this session`}
        >
          {history.length === 0 ? (
            <p className="text-sm text-slate-500">
              Recent lookups will appear here after you scan or search.
            </p>
          ) : (
            <ul className="space-y-2">
              {history.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => replayHistory(item)}
                    className="flex w-full items-start justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-3 text-left transition hover:border-cyan-500/40 hover:bg-slate-800/60"
                  >
                    <span>
                      <span className="block font-medium text-white">
                        {item.label}
                      </span>
                      <span className="mt-1 block text-xs text-slate-500">
                        {item.detectedType} ·{" "}
                        {new Date(item.scannedAt).toLocaleTimeString()}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 text-xs font-semibold ${
                        item.found ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {item.found ? "Found" : "Miss"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </MatrixCard>

        <MatrixCard
          title="Parts Order Draft"
          subtitle={`${orderDraft.length} line(s) from scanner`}
        >
          {orderDraft.length === 0 ? (
            <p className="text-sm text-slate-500">
              Part results can be added here before opening Parts Order Builder.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {orderDraft.slice(0, 6).map((line) => (
                <li
                  key={line.id}
                  className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2"
                >
                  <p className="font-mono text-cyan-400">{line.partNumber}</p>
                  <p className="mt-1 text-slate-300">
                    Qty {line.quantity} · {line.reason}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {orderDraft.length > 0 && (
            <div className="mt-4">
              <MatrixButton
                href="/parts-order-builder"
                variant="primary"
                size="md"
              >
                Open Parts Order Builder
              </MatrixButton>
            </div>
          )}
        </MatrixCard>
      </div>

      <MatrixCard
        title="Future Integration Points"
        subtitle="Placeholder hooks for camera, labels, and live databases."
      >
        <ul className="grid gap-2 text-sm text-slate-400 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(SCANNER_INTEGRATION_PLACEHOLDERS).map(
            ([key, value]) => (
              <li
                key={key}
                className="rounded-lg border border-dashed border-slate-700 bg-slate-950/40 px-3 py-2"
              >
                <span className="font-medium text-slate-300">{key}</span>
                <span className="ml-2 text-xs uppercase tracking-wide text-slate-600">
                  {value}
                </span>
              </li>
            ),
          )}
        </ul>
      </MatrixCard>
    </div>
  );
}
