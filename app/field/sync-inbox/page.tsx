"use client";

import { startTransition, useCallback, useEffect, useState } from "react";
import FieldShell from "../FieldShell";
import { useFieldIdentity } from "../FieldIdentityProvider";
import { canViewOtherTechniciansField } from "@/lib/auth/field-permissions";

type Receipt = {
  operationId: string;
  type: string;
  status: string;
  technicianName: string | null;
  workOrderId: string | null;
  printerId: string | null;
  createdAt: string;
  updatedAt: string;
  lastError: string | null;
};

export default function FieldSyncInboxPage() {
  const { role } = useFieldIdentity();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [notice, setNotice] = useState("Loading server receipts…");
  const [processing, setProcessing] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/field/sync?limit=50", { cache: "no-store" });
      const body = await response.json() as { receipts?: Receipt[]; error?: string };
      if (!response.ok) throw new Error(body.error ?? "Could not load server receipts.");
      startTransition(() => {
        setReceipts(body.receipts ?? []);
        setNotice("");
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load server receipts.";
      startTransition(() => setNotice(message));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!canViewOtherTechniciansField(role)) {
    return <FieldShell title="Sync Inbox"><p className="rounded-xl border border-rose-700/60 bg-rose-500/10 p-4 text-sm text-rose-100">You do not have access to the server sync inbox.</p></FieldShell>;
  }

  async function processNotes() {
    if (processing) return;
    setProcessing(true);
    setNotice("Processing received Field notes…");
    try {
      const response = await fetch("/api/field/sync/process", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      const body = await response.json() as { applied?: number; waiting?: number; error?: string };
      if (!response.ok) throw new Error(body.error ?? "Could not process Field notes.");
      const processed = `Processed ${body.applied ?? 0} note(s). ${body.waiting ?? 0} still need a server work order.`;
      await load();
      startTransition(() => setNotice(processed));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not process Field notes.");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <FieldShell title="Sync Inbox">
      <p className="mb-4 text-sm text-slate-300">Server receipts are proof that Matrix received an authorized Field change. They are waiting for the next processing step and do not yet mean a work order was updated.</p>
      <button type="button" onClick={() => { setNotice("Loading server receipts…"); void load(); }} className="mb-4 min-h-11 rounded-lg border border-slate-600 px-4 text-sm font-semibold">Refresh</button>
      <button type="button" disabled={processing} onClick={() => void processNotes()} className="mb-4 ml-2 min-h-11 rounded-lg bg-cyan-500 px-4 text-sm font-semibold text-slate-950 disabled:opacity-50">{processing ? "Processing…" : "Process Received Notes"}</button>
      {notice && <p role="status" className="mb-4 rounded-xl border border-cyan-800/50 bg-cyan-950/40 p-3 text-sm text-cyan-100">{notice}</p>}
      <ul className="space-y-3">
        {receipts.length === 0 && !notice && <li className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">No server receipts yet.</li>}
        {receipts.map((receipt) => (
          <li key={receipt.operationId} className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-sm">
            <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{receipt.type.replaceAll("_", " ")}</p><p className="mt-1 text-xs text-slate-400">{receipt.technicianName ?? "Unknown technician"} · {new Date(receipt.createdAt).toLocaleString()}</p></div><span className="rounded-full bg-cyan-500/15 px-2 py-1 text-xs font-semibold text-cyan-200">{receipt.status}</span></div>
            <p className="mt-2 text-xs text-slate-500">Work order: {receipt.workOrderId ?? "—"} · Printer: {receipt.printerId ?? "—"}</p>
            {receipt.lastError && <p className="mt-2 text-xs text-rose-200">{receipt.lastError}</p>}
          </li>
        ))}
      </ul>
    </FieldShell>
  );
}
