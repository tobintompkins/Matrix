"use client";
import { useFieldIdentity } from "@/app/field/FieldIdentityProvider";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import FieldShell from "../FieldShell";
import { prioritizeMobileWork } from "@/lib/field/mobile-work-queue";
import {
  downloadWorkOrderPackage,
  downloadWorkOrders,
  filterFieldWorkOrders,
  isWorkOrderDownloaded,
  listOfflinePackages,
  type FieldWorkFilter,
  type OfflinePackage,
} from "@/lib/field";
import {
  getWorkOrderPriorityLabel,
  getWorkOrderStatusLabel,
  listWorkOrders,
} from "@/lib/work-orders";


const FILTERS: Array<{ id: FieldWorkFilter | "ALL"; label: string }> = [
  { id: "ALL", label: "All" },
  { id: "TODAY", label: "Today" },
  { id: "TOMORROW", label: "Tomorrow" },
  { id: "THIS_WEEK", label: "This Week" },
  { id: "OVERDUE", label: "Overdue" },
  { id: "CRITICAL", label: "Critical" },
  { id: "WAITING_FOR_PARTS", label: "Waiting Parts" },
  { id: "COMPLETED", label: "Completed" },
  { id: "DOWNLOADED", label: "Downloaded" },
];

export default function FieldWorkListPage() {
  const { technicianName: TECH, userId: TECH_ID } = useFieldIdentity();
  const [filter, setFilter] = useState<FieldWorkFilter | "ALL">("TODAY");
  const [search, setSearch] = useState("");
  const [packages, setPackages] = useState<OfflinePackage[]>([]);
  const [tick, setTick] = useState(0);
  const [notice, setNotice] = useState("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let current = true;
    void listOfflinePackages(TECH_ID).then(items => { if (current) setPackages(items); }).catch(() => { if (current) setNotice("Could not read saved downloads. Retry the page before going offline."); });
    return () => { current = false; };
  }, [tick, TECH_ID]);

  const orders = useMemo(() => {
    void tick;
    return listWorkOrders();
  }, [tick]);

  const visible = useMemo(
    () => prioritizeMobileWork(filterFieldWorkOrders(orders, filter, packages, search, TECH)),
    [orders, filter, packages, search, TECH],
  );

  async function runDownload(action: () => Promise<void>) {
    if (downloading) return;
    setDownloading(true);
    setNotice("Saving work for offline use…");
    try {
      await action();
    } catch {
      setNotice("Download did not finish. Some jobs may have saved. Check each job's Offline status before retrying.");
    } finally {
      setDownloading(false);
      setTick(t => t + 1);
    }
  }

  async function downloadOne(id: string) {
    const wo = orders.find((w) => w.id === id);
    if (!wo) return;
    await downloadWorkOrderPackage({ workOrder: wo, technicianId: TECH_ID });
    setNotice(`Downloaded ${wo.workOrderNumber} for offline use.`);
    setTick((t) => t + 1);
  }

  async function downloadToday() {
    const today = filterFieldWorkOrders(orders, "TODAY", packages, "", TECH);
    await downloadWorkOrders(today, TECH_ID);
    setNotice(`Downloaded ${today.length} work order(s) for today.`);
    setTick((t) => t + 1);
  }

  async function downloadWeek() {
    const week = filterFieldWorkOrders(orders, "THIS_WEEK", packages, "", TECH);
    await downloadWorkOrders(week, TECH_ID);
    setNotice(`Downloaded ${week.length} work order(s) for this week.`);
    setTick((t) => t + 1);
  }

  return (
    <FieldShell title="Assigned Work">
      <p className="mb-4 text-sm text-slate-300">Find a job, open its details, or save it before going offline. Active and urgent work appears first.</p>
      <label className="sr-only" htmlFor="field-work-search">
        Search work orders
      </label>
      <input
        id="field-work-search"
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search WO #, customer, site, printer…"
        className="mb-4 min-h-12 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 text-base text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
      />

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Work filters">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold ${
              filter === f.id
                ? "bg-cyan-500 text-slate-950"
                : "bg-slate-900 text-slate-300 ring-1 ring-slate-700"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void runDownload(downloadToday)}
          disabled={downloading}
          className="min-h-11 rounded-lg border border-slate-600 px-3 text-xs font-semibold text-slate-200"
        >
          Download Today
        </button>
        <button
          type="button"
          onClick={() => void runDownload(downloadWeek)}
          disabled={downloading}
          className="min-h-11 rounded-lg border border-slate-600 px-3 text-xs font-semibold text-slate-200"
        >
          Download This Week
        </button>
      </div>

      <p className="mb-3 text-sm text-slate-400" role="status">{visible.length} matching work order(s)</p>
      {notice && (
        <p role="status" className="mb-4 rounded-xl border border-cyan-800/50 bg-cyan-950/40 px-4 py-3 text-sm text-cyan-100">
          {notice}
        </p>
      )}

      <ul className="space-y-3">
        {visible.length === 0 && (
          <li className="rounded-xl border border-dashed border-slate-700 px-4 py-10 text-center text-sm text-slate-500">
            <p>No work orders match this filter.</p>
            <button type="button" onClick={() => { setFilter("ALL"); setSearch(""); }} className="mt-3 min-h-11 rounded-lg border border-slate-600 px-4 text-cyan-300">Show all my work</button>
          </li>
        )}
        {visible.map((wo) => {
          const offline = isWorkOrderDownloaded(packages, wo.id);
          const pkg = packages.find((p) => p.workOrderId === wo.id);
          return (
            <li key={wo.id}>
              <article className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link
                      href={`/field/work/${wo.id}`}
                      className="font-mono text-sm font-semibold text-cyan-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
                    >
                      {wo.workOrderNumber}
                    </Link>
                    <h3 className="mt-1 text-base font-bold text-white">{wo.customerName}</h3>
                    <p className="text-sm text-slate-400">{wo.siteName}</p>
                  </div>
                  <div className="text-right text-xs">
                    <p className="font-semibold text-amber-300">
                      {getWorkOrderPriorityLabel(wo.priority)}
                    </p>
                    <p className="mt-1 text-slate-400">
                      {getWorkOrderStatusLabel(wo.status)}
                    </p>
                  </div>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-300">
                  <div>
                    <dt className="text-slate-500">Printer</dt>
                    <dd>{wo.printerName ?? "—"} · {wo.printerModel ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Service</dt>
                    <dd>{wo.serviceType.replaceAll("_", " ")}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Scheduled</dt>
                    <dd>
                      {wo.scheduledStart
                        ? new Date(wo.scheduledStart).toLocaleString()
                        : "Unscheduled"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Duration</dt>
                    <dd>{wo.estimatedHours != null ? `${wo.estimatedHours}h` : "—"}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-slate-500">Address</dt>
                    <dd>{wo.siteAddress || "—"}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-slate-500">Parts</dt>
                    <dd>
                      {wo.parts.length
                        ? wo.parts
                            .slice(0, 3)
                            .map((p) => `${p.partNumber}×${p.quantity}`)
                            .join(", ")
                        : "None listed"}
                    </dd>
                  </div>
                </dl>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/field/work/${wo.id}`}
                    className="min-h-11 flex-1 rounded-xl bg-cyan-500 px-3 py-2 text-center text-sm font-semibold text-slate-950"
                  >
                    Open
                  </Link>
                  <button
                    type="button"
                    onClick={() => void runDownload(() => downloadOne(wo.id))}
                    disabled={downloading}
                    className="min-h-11 rounded-xl border border-slate-600 px-3 text-sm font-semibold text-slate-200"
                  >
                    {offline ? "Refresh Offline" : "Download Offline"}
                  </button>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Offline:{" "}
                  {offline
                    ? `Ready · ${pkg ? new Date(pkg.downloadedAt).toLocaleString() : ""} · ${pkg ? `${Math.round(pkg.sizeBytes / 1024)} KB` : ""}`
                    : "Not downloaded"}
                  {pkg?.readiness === "STALE" ? " · Refresh recommended" : ""}
                </p>
              </article>
            </li>
          );
        })}
      </ul>
    </FieldShell>
  );
}
