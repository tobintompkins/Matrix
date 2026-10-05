"use client";

import { startTransition, useCallback, useEffect, useState } from "react";
import FieldShell from "../FieldShell";
import { useFieldIdentity } from "../FieldIdentityProvider";
import { canViewOtherTechniciansField } from "@/lib/auth/field-permissions";
import FieldDeviceVerificationChecklist from "./FieldDeviceVerificationChecklist";
import FieldOperationalReleaseGateCard from "./FieldOperationalReleaseGateCard";
import FieldSyncOperationsCard from "./FieldSyncOperationsCard";
import FieldTechnicianIdBackfillExportCard from "./FieldTechnicianIdBackfillExportCard";
import FieldTechnicianIdBackfillPreviewCard from "./FieldTechnicianIdBackfillPreviewCard";
import FieldTechnicianIdCoverageCard from "./FieldTechnicianIdCoverageCard";
import FieldSyncProcessHistoryCard from "./FieldSyncProcessHistoryCard";
import FieldSyncReceiptReviewQueue from "./FieldSyncReceiptReviewQueue";
import FieldReleaseReadinessCard from "./FieldReleaseReadinessCard";
import {
  FIELD_SYNC_PROCESS_BATCH_LIMITS,
  toFieldSyncProcessBatchLimit,
} from "@/lib/field/sync-process-batch";

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

type BridgeRollout = { enabled: boolean; pilotWorkOrder: string | null };
type PilotValidation = { selected: boolean; found: boolean; ready: boolean; workOrderNumber: string | null };

export default function FieldSyncInboxPage() {
  const { role } = useFieldIdentity();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [notice, setNotice] = useState("Loading server receipts…");
  const [processing, setProcessing] = useState(false);
  const [processBatchLimit, setProcessBatchLimit] = useState(25);
  const [lastProcessedAt, setLastProcessedAt] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<WorkOrderReadiness | null>(null);
  const [readinessNotice, setReadinessNotice] = useState("");
  const [rollout, setRollout] = useState<BridgeRollout | null>(null);
  const [pilotValidation, setPilotValidation] = useState<PilotValidation | null>(null);

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

  const loadBridgeStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/field/bridge-rollout", { cache: "no-store" });
      const body = await response.json() as { rollout?: BridgeRollout; readiness?: WorkOrderReadiness; pilot?: PilotValidation; error?: string };
      if (!response.ok) throw new Error(body.error ?? "Could not load bridge status.");
      startTransition(() => {
        setRollout(body.rollout ?? null);
        setPilotValidation(body.pilot ?? null);
        if (body.readiness) setReadiness(body.readiness);
        setReadinessNotice("");
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load bridge status.";
      startTransition(() => setReadinessNotice(message));
    }
  }, []);

  useEffect(() => {
    void load();
    void loadReadiness();
    void loadBridgeStatus();
  }, [load, loadReadiness, loadBridgeStatus]);

  if (!canViewOtherTechniciansField(role)) {
    return <FieldShell title="Sync Inbox"><p className="rounded-xl border border-rose-700/60 bg-rose-500/10 p-4 text-sm text-rose-100">You do not have access to the server sync inbox.</p></FieldShell>;
  }

  async function processReceipts() {
    if (processing) return;
    setProcessing(true);
    setNotice("Processing received Field receipts…");
    try {
      const response = await fetch("/api/field/sync/process", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ limit: processBatchLimit }) });
      const body = await response.json() as {
        notes?: { applied?: number; waiting?: number };
        statuses?: { applied?: number; waiting?: number };
        completions?: { applied?: number; waiting?: number };
        copyCounts?: { applied?: number; waiting?: number };
        maintenance?: { applied?: number; waiting?: number };
        workSessions?: { applied?: number; waiting?: number };
        timeEntries?: { applied?: number; waiting?: number };
        photos?: { applied?: number; waiting?: number };
        attachments?: { applied?: number; waiting?: number };
        signatures?: { applied?: number; waiting?: number };
        parts?: { applied?: number; waiting?: number };
        error?: string;
      };
      if (!response.ok) throw new Error(body.error ?? "Could not process Field receipts.");
      setLastProcessedAt(new Date().toISOString());
      const processed = body as { notes?: { applied?: number }; statuses?: { applied?: number }; completions?: { applied?: number }; copyCounts?: { applied?: number }; maintenance?: { applied?: number }; workSessions?: { applied?: number }; timeEntries?: { applied?: number }; photos?: { applied?: number }; attachments?: { applied?: number }; signatures?: { applied?: number }; parts?: { applied?: number } };
      await load();
      window.dispatchEvent(new Event("matrix-field-receipts-processed"));
      startTransition(() => setNotice(`Processed up to ${processBatchLimit} of each receipt type: ${processed.notes?.applied ?? 0} notes, ${processed.statuses?.applied ?? 0} status changes, ${processed.workSessions?.applied ?? 0} work sessions, ${processed.timeEntries?.applied ?? 0} time entries, ${processed.completions?.applied ?? 0} completions, ${processed.copyCounts?.applied ?? 0} copy counts, ${processed.maintenance?.applied ?? 0} maintenance records, ${processed.photos?.applied ?? 0} photos, ${processed.attachments?.applied ?? 0} attachments, ${processed.signatures?.applied ?? 0} signatures, and ${processed.parts?.applied ?? 0} parts entries.`));
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
      <label className="mb-4 ml-2 inline-flex min-h-11 items-center gap-2 text-xs text-slate-300">Processing batch
        <select value={processBatchLimit} disabled={processing} onChange={(event) => setProcessBatchLimit(toFieldSyncProcessBatchLimit(event.target.value))} className="min-h-11 rounded-lg border border-slate-600 bg-slate-950 px-2 text-sm text-slate-100 disabled:opacity-50">
          {FIELD_SYNC_PROCESS_BATCH_LIMITS.map((limit) => <option key={limit} value={limit}>{limit} per type</option>)}
        </select>
      </label>
      <button type="button" disabled={processing} onClick={() => void processReceipts()} className="mb-4 ml-2 min-h-11 rounded-lg bg-cyan-500 px-4 text-sm font-semibold text-slate-950 disabled:opacity-50">{processing ? "Processing…" : "Process Received Receipts"}</button>
      {lastProcessedAt && <p className="mb-4 text-xs text-slate-400">Last processed: {new Date(lastProcessedAt).toLocaleString()}</p>}
      {notice && <p role="status" className="mb-4 rounded-xl border border-cyan-800/50 bg-cyan-950/40 p-3 text-sm text-cyan-100">{notice}</p>}
      <FieldOperationalReleaseGateCard />
      <FieldSyncOperationsCard />
      <FieldTechnicianIdCoverageCard />
      <FieldTechnicianIdBackfillExportCard />
      <FieldTechnicianIdBackfillPreviewCard />
      <FieldSyncProcessHistoryCard />
      <FieldReleaseReadinessCard />
      <FieldDeviceVerificationChecklist />
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
      <section className="mb-5 rounded-xl border border-slate-700 bg-slate-900 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Field Bridge Pilot Status</h2><p className="mt-1 text-xs text-slate-400">Read-only rollout status. The bridge must stay limited to one verified job during the first pilot.</p></div><button type="button" onClick={() => void loadBridgeStatus()} className="min-h-10 rounded-lg border border-slate-600 px-3 text-xs font-semibold">Refresh status</button></div>
        {rollout && <p className="mt-3 text-sm text-slate-300">Bridge: <span className="font-semibold">{rollout.enabled ? "enabled" : "off"}</span> · Pilot job: <span className="font-semibold">{rollout.pilotWorkOrder ?? "not selected"}</span></p>}
        {pilotValidation && <p className={pilotValidation.ready ? "mt-2 text-sm text-emerald-200" : "mt-2 text-sm text-amber-200"}>{pilotValidation.ready ? `Pilot job ${pilotValidation.workOrderNumber} is ready for a controlled test.` : pilotValidation.selected ? "Pilot job needs a durable record, technician assignment, schedule, and status before testing." : "Select one verified pilot job before enabling the bridge."}</p>}
      </section>
      <FieldSyncReceiptReviewQueue receipts={receipts} loading={notice.startsWith("Loading")} />
    </FieldShell>
  );
}
