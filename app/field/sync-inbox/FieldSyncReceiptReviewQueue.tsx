"use client";

import { useMemo, useState } from "react";
import {
  buildFieldSyncReceiptReviewCsv,
  filterFieldSyncReceipts,
  listFieldSyncReceiptTypes,
  type FieldSyncReceiptListItem,
} from "@/lib/field/sync-receipt-queue";

export default function FieldSyncReceiptReviewQueue(props: {
  receipts: FieldSyncReceiptListItem[];
  loading: boolean;
}) {
  const [status, setStatus] = useState<"ALL" | "RECEIVED" | "APPLIED" | "REJECTED">("ALL");
  const [type, setType] = useState("ALL");
  const [query, setQuery] = useState("");
  const types = useMemo(() => listFieldSyncReceiptTypes(props.receipts), [props.receipts]);
  const visibleReceipts = useMemo(
    () => filterFieldSyncReceipts(props.receipts, { status, type, query }),
    [props.receipts, status, type, query],
  );

  function downloadReviewCsv() {
    const csv = buildFieldSyncReceiptReviewCsv(visibleReceipts);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "matrix-field-receipt-review.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="mb-5 rounded-xl border border-slate-700 bg-slate-900 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-100">Receipt Review Queue</h2>
          <p className="mt-1 text-xs text-slate-400">Find waiting or rejected Field changes quickly. This view is read-only.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => { setStatus("REJECTED"); setType("ALL"); setQuery(""); }}
            className="min-h-10 rounded-lg border border-rose-800 px-3 text-xs font-semibold text-rose-100"
          >
            Show review-needed
          </button>
          <button
            type="button"
            onClick={downloadReviewCsv}
            disabled={visibleReceipts.length === 0}
            className="min-h-10 rounded-lg border border-slate-600 px-3 text-xs font-semibold text-slate-100 disabled:opacity-50"
          >
            Download review CSV
          </button>
        </div>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <label className="text-xs text-slate-400">Status
          <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 text-sm text-slate-100">
            <option value="ALL">All statuses</option>
            <option value="RECEIVED">Waiting to process</option>
            <option value="REJECTED">Needs review</option>
            <option value="APPLIED">Applied</option>
          </select>
        </label>
        <label className="text-xs text-slate-400">Type
          <select value={type} onChange={(event) => setType(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 text-sm text-slate-100">
            <option value="ALL">All receipt types</option>
            {types.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}
          </select>
        </label>
        <label className="text-xs text-slate-400">Search
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Work order, technician, error…" className="mt-1 min-h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100" />
        </label>
      </div>

      <p className="mt-3 text-xs text-slate-400">Showing {visibleReceipts.length} of {props.receipts.length} receipts.</p>
      <ul className="mt-3 space-y-3">
        {visibleReceipts.length === 0 && !props.loading && <li className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">No receipts match this review filter.</li>}
        {visibleReceipts.map((receipt) => (
          <li key={receipt.operationId} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-sm">
            <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{receipt.type.replaceAll("_", " ")}</p><p className="mt-1 text-xs text-slate-400">{receipt.technicianName ?? "Unknown technician"} · {new Date(receipt.createdAt).toLocaleString()}</p></div><span className="rounded-full bg-cyan-500/15 px-2 py-1 text-xs font-semibold text-cyan-200">{receipt.status}</span></div>
            <p className="mt-2 text-xs text-slate-500">Work order: {receipt.workOrderId ?? "—"} · Printer: {receipt.printerId ?? "—"}</p>
            {receipt.lastError && <p className="mt-2 text-xs text-rose-200">{receipt.lastError}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
