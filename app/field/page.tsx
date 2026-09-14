"use client";
import { useFieldIdentity } from "@/app/field/FieldIdentityProvider";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import FieldShell from "./FieldShell";
import {
  buildFieldHomeMetrics,
  countPendingOps,
  getConnectivityService,
  synchronizeQueue,
  type ConnectivityStatus,
} from "@/lib/field";
import { listWorkOrders } from "@/lib/work-orders";
import { nextMobileWork } from "@/lib/field/mobile-work-queue";


export default function FieldHomePage() {
  const { technicianName: TECH, userId: TECH_ID } = useFieldIdentity();
  const [tick, setTick] = useState(0);
  const [status, setStatus] = useState<ConnectivityStatus>("ONLINE");
  const [unsynced, setUnsynced] = useState(0);
  const [notice, setNotice] = useState("");
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    return getConnectivityService().subscribe(setStatus);
  }, []);

  useEffect(() => {
    let current = true;
    void countPendingOps(TECH_ID).then(count => { if (current) setUnsynced(count); }).catch(() => { if (current) setNotice("Could not read offline changes. Open Offline Queue to review."); });
    return () => { current = false; };
  }, [tick, TECH_ID]);

  const orders = useMemo(() => {
    void tick;
    return listWorkOrders();
  }, [tick]);

  const metrics = useMemo(
    () =>
      buildFieldHomeMetrics({
        technicianName: TECH,
        workOrders: orders,
        connectivity: status,
        unsyncedChanges: unsynced,
      }),
    [orders, status, unsynced, TECH],
  );

  const nextJob = useMemo(() => {
    return nextMobileWork(orders, TECH);
  }, [orders, TECH]);

  async function syncNow() {
    if (syncing) return;
    setSyncing(true);
    setNotice("Synchronizing…");
    try {
      const attempt = await synchronizeQueue({ userId: TECH_ID });
      setNotice(`Sync finished: ${attempt.succeeded} saved, ${attempt.failed} failed, ${attempt.conflicts} conflicts. Review Offline Queue for anything still pending.`);
      setTick(t => t + 1);
    } catch {
      setNotice("Sync could not finish. Your pending changes remain available in Offline Queue. Review them before retrying.");
    } finally {
      setSyncing(false);
    }
  }

  const actions = [
    {
      label: nextJob ? "Open Next Job" : "View Assigned Work",
      href: nextJob ? `/field/work/${nextJob.id}` : "/field/work",
    },
    { label: "Enter Copy Count", href: "/field/copy-count" },
    { label: "Scan or Find Printer", href: "/field/printers" },
    { label: "Create Service Note", href: "/field/work" },
    { label: "View Parts", href: "/field/parts" },
    { label: "Open Offline Queue", href: "/field/offline" },
  ];

  return (
    <FieldShell title="Today">
      <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <p className="text-sm text-slate-400">{metrics.dateLabel}</p>
        <h2 className="mt-1 text-2xl font-bold">{metrics.technicianName}</h2>
        <p className="mt-2 text-sm text-slate-300">
          Assigned work prioritized for field service.
        </p>
      </section>

      <section aria-labelledby="next-job-heading" className="mb-6 rounded-2xl border border-cyan-700/60 bg-slate-900 p-5">
        <h3 id="next-job-heading" className="text-sm font-semibold text-cyan-300">Your next job</h3>
        {nextJob ? (
          <>
            <p className="mt-2 text-xl font-semibold">{nextJob.customerName}</p>
            <p className="mt-1 text-sm text-slate-300">{nextJob.workOrderNumber} · {nextJob.siteName}</p>
            <p className="mt-2 text-sm text-slate-400">
              {nextJob.scheduledStart ? new Date(nextJob.scheduledStart).toLocaleString() : "Time not scheduled"}
            </p>
            <Link href={`/field/work/${nextJob.id}`} className="mt-4 inline-flex min-h-12 items-center rounded-xl bg-cyan-400 px-5 font-semibold text-slate-950">Open job details →</Link>
          </>
        ) : (
          <p className="mt-2 text-sm text-slate-300">No ready job for today. <Link href="/field/work" className="text-cyan-300 underline">Review assigned work</Link> for future visits or work on hold.</p>
        )}
        <p className="mt-3 text-xs text-slate-400">Active work first, then critical and overdue work. Opening a job does not start it.</p>
      </section>

      {notice && (
        <p
          className="mb-4 rounded-xl border border-cyan-800/50 bg-cyan-950/40 px-4 py-3 text-sm text-cyan-100"
          role="status"
        >
          {notice}
        </p>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          ["Scheduled today", metrics.scheduledToday],
          ["Overdue", metrics.overdue],
          ["Critical", metrics.critical],
          ["Waiting parts", metrics.waitingForParts],
          ["Completed today", metrics.recentlyCompleted],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="rounded-xl border border-slate-800 bg-slate-900 p-4"
          >
            <p className="text-xs text-slate-400">{label}</p>
            <p className="mt-1 text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      {metrics.unsyncedChanges > 0 && (
        <Link
          href="/field/offline"
          className="mb-6 flex min-h-12 items-center justify-between rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
        >
          <span>{metrics.unsyncedChanges} unsynchronized offline change(s)</span>
          <span className="font-semibold">Review →</span>
        </Link>
      )}

      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => void syncNow()}
          disabled={syncing || status === "OFFLINE"}
          aria-busy={syncing}
          className="min-h-12 flex-1 rounded-xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
        >
          {syncing ? "Synchronizing…" : status === "OFFLINE" ? "Offline — sync when connected" : "Synchronize Now"}
        </button>
        <button
          type="button"
          onClick={() => setTick((t) => t + 1)}
          className="min-h-12 rounded-xl border border-slate-600 px-4 py-3 text-sm font-semibold text-slate-200"
        >
          Refresh
        </button>
      </div>

      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
        Quick actions
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {actions.map((a) => (
          <Link
            key={a.label}
            href={a.href}
            className="flex min-h-14 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 px-4 text-center text-sm font-semibold text-slate-100 hover:border-cyan-500 hover:text-cyan-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
          >
            {a.label}
          </Link>
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-slate-500">
        Offline packages: use Assigned Work → Download.{" "}
        <Link href="/field/settings" className="text-cyan-400 underline">
          Field data settings
        </Link>
      </p>
    </FieldShell>
  );
}
