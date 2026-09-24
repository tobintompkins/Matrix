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

type WorkOrderReadiness = {
  bridgeEnabled: boolean;
  totalWorkOrders: number;
  readyWorkOrders: number;
  blockingWorkOrders: number;
  readyToEnable: boolean;
  issues: Array<{ workOrderId: string; workOrderNumber: string; title: string; issues: string[] }>;
};

export default function FieldSyncInboxPage() {
  const { role } = useFieldIdentity();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [notice, setNotice] = useState("Loading server receipts…");
  const [processing, setProcessing] = useState(false);
  const [lastProcessedAt, setLastProcessedAt] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<WorkOrderReadiness | null>(null);
  const [readinessNotice, setReadinessNotice] = useState("");

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

  const loadReadiness = useCallback(async () => {
    try {
      const response = await fetch("/api/field/server-readiness", { cache: "no-store" });
      const body = await response.json() as { readiness?: WorkOrderReadiness; error?: string };
      if (!response.ok) throw new Error(body.error ?? "Could not check server work-order readiness.");
      startTransition(() => {
        setReadiness(body.readiness ?? null);
        setReadinessNotice("");
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not check server work-order readiness.";
      startTransition(() => setReadinessNotice(message));
    }
  }, []);

  useEffect(() => {
    void load();
    void loadReadiness();
  }, [load, loadReadiness]);

  if (!canViewOtherTechniciansField(role)) {
    return <FieldShell title="Sync Inbox"><p className="rounded-xl border border-rose-700/60 bg-rose-500/10 p-4 text-sm text-rose-100">You do not have access to the server sync inbox.</p></FieldShell>;
  }

  async function processReceipts() {
    if (processing) return;
    setProcessing(true);
    setNotice("Processing received Field receipts…");
    try {
      const response = await fetch("/api/field/sync/process", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      const body = await response.json() as {
        notes?: { applied?: number; waiting?: number };
        statuses?: { applied?: number; waiting?: number };
        completions?: { applied?: number; waiting?: number };
        photos?: { applied?: number; waiting?: number };
        attachments?: { applied?: number; waiting?: number };
        parts?: { applied?: number; waiting?: number };
        error?: string;
      };
      if (!response.ok) throw new Error(body.error ?? "Could not process Field receipts.");
      setLastProcessedAt(new Date().toISOString());
      const processed = body as { notes?: { applied?: number }; statuses?: { applied?: number }; completions?: { applied?: number }; photos?: { applied?: number }; attachments?: { applied?: number }; parts?: { applied?: number } };
      await load();
      startTransition(() => setNotice(`Processed: ${processed.notes?.applied ?? 0} notes, ${processed.statuses?.applied ?? 0} status changes, ${processed.completions?.applied ?? 0} completions, ${processed.photos?.applied ?? 0} photos, ${processed.attachments?.applied ?? 0} attachments, and ${processed.parts?.applied ?? 0} parts entries.`));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not process Field receipts.");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <FieldShell title="Sync Inbox">
      <p className="mb-4 text-sm text-slate-300">Server receipts are proof that Matrix received an authorized Field change. They are waiting for the next processing step and do not yet mean a work order was updated.</p>
      <button type="button" onClick={() => { setNotice("Loading server receipts…"); void load(); }} className="mb-4 min-h-11 rounded-lg border border-slate-600 px-4 text-sm font-semibold">Refresh</button>
      <button type="button" disabled={processing} onClick={() => void processReceipts()} className="mb-4 ml-2 min-h-11 rounded-lg bg-cyan-500 px-4 text-sm font-semibold text-slate-950 disabled:opacity-50">{processing ? "Processing…" : "Process Received Receipts"}</button>
      {lastProcessedAt && <p className="mb-4 text-xs text-slate-400">Last processed: {new Date(lastProcessedAt).toLocaleString()}</p>}
      {notice && <p role="status" className="mb-4 rounded-xl border border-cyan-800/50 bg-cyan-950/40 p-3 text-sm text-cyan-100">{notice}</p>}
      <section className="mb-5 rounded-xl border border-slate-700 bg-slate-900 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-semibold">Server Work-Order Readiness</h2><p className="mt-1 text-xs text-slate-400">Read-only check before the durable work-order bridge is enabled.</p></div>
          <button type="button" onClick={() => void loadReadiness()} className="min-h-10 rounded-lg border border-slate-600 px-3 text-xs font-semibold">Check readiness</button>
        </div>
        {readinessNotice && <p className="mt-3 text-sm text-rose-200">{readinessNotice}</p>}
        {readiness && <div className="mt-3 text-sm">
          <p className={readiness.readyToEnable ? "text-emerald-200" : "text-amber-200"}>{readiness.readyToEnable ? "Ready to test the bridge with a controlled rollout." : "Not ready to enable the bridge yet."}</p>
          <p className="mt-1 text-xs text-slate-400">{readiness.readyWorkOrders} ready of {readiness.totalWorkOrders} server work orders · {readiness.blockingWorkOrders} need attention · Bridge {readiness.bridgeEnabled ? "enabled" : "off"}</p>
          {readiness.issues.length > 0 && <ul className="mt-3 space-y-2 text-xs text-slate-300">{readiness.issues.map((issue) => <li key={issue.workOrderId} className="rounded-lg bg-slate-950/60 p-2"><span className="font-semibold">{issue.workOrderNumber}</span> · {issue.title}<span className="block text-amber-200">{issue.issues.join(" · ")}</span></li>)}</ul>}
        </div>}
      </section>
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
