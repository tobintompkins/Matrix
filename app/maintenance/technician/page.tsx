"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import MatrixShell from "../../components/MatrixShell";
import MatrixAuthGuard from "../../components/MatrixAuthGuard";
import {
  MatrixButton,
  MatrixCard,
  MatrixPageHeader,
  MatrixStatCard,
} from "../../components/ui";
import MaintenanceSubnav from "../components/MaintenanceSubnav";
import PmCleaningStatusBadge from "../components/PmCleaningStatusBadge";
import { fetchTechnicianPmDashboard } from "@/lib/maintenance/pm-api-client";
import type { PmDashboardRow } from "@/lib/maintenance/pm-prisma-repository";

export default function TechnicianPmDashboardPage() {
  const [technician, setTechnician] = useState("Alex Rivera");
  const [input, setInput] = useState("Alex Rivera");
  const [scopedToSelf, setScopedToSelf] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<{
    technician: string;
    todaysPms: number;
    overduePms: number;
    duePms: number;
    dueSoonPms: number;
    completedToday: number;
    completedThisWeek: number;
    averagePmTimeMinutes: number | null;
    assignedMachines: PmDashboardRow[];
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetchTechnicianPmDashboard(technician);
        if (cancelled) return;
        if (!res.ok || !res.data) {
          setError(res.error ?? "Failed to load technician PM view");
          setData(null);
          return;
        }
        setData(res.data);
        setScopedToSelf(Boolean(res.scopedToSelf));
        if (res.scopedToSelf && res.actorDisplayName) {
          setInput(res.actorDisplayName);
          setTechnician(res.actorDisplayName);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [technician]);

  const todaysList =
    data?.assignedMachines.filter((m) =>
      ["DUE", "DUE_SOON", "OVERDUE"].includes(m.status),
    ) ?? [];
  const overdueList =
    data?.assignedMachines.filter((m) => m.status === "OVERDUE") ?? [];

  return (
    <MatrixShell title="Technician PM" activePath="/maintenance">
      <MatrixAuthGuard requiredPermissions={["VIEW_FLEET_MAINTENANCE"]}>
        <MatrixPageHeader
          title="Technician PM"
          subtitle="Today's PMs, overdue work, completions, and assigned machines."
          breadcrumbs={["Matrix", "Preventive Maintenance", "Technician"]}
        />
        <MaintenanceSubnav />

        <form
          className="mb-6 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setTechnician(input.trim());
          }}
        >
          <label className="block min-w-[16rem] flex-1 text-sm text-slate-400">
            Technician
            <input
              className="mt-1 min-h-12 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-base text-slate-100 disabled:opacity-60"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={scopedToSelf}
              readOnly={scopedToSelf}
            />
          </label>
          {!scopedToSelf ? (
            <MatrixButton type="submit" variant="primary" className="min-h-12">
              Load
            </MatrixButton>
          ) : (
            <p className="pb-3 text-xs text-slate-500">
              Showing only your assigned PM work.
            </p>
          )}
        </form>

        {error ? (
          <p className="mb-4 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
            {error}
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : data ? (
          <>
            <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <MatrixStatCard label="Today's PMs" value={data.todaysPms} />
              <MatrixStatCard
                label="Overdue PMs"
                value={data.overduePms}
                accent="text-rose-400"
              />
              <MatrixStatCard
                label="Completed today"
                value={data.completedToday}
                accent="text-emerald-400"
              />
              <MatrixStatCard
                label="Completed this week"
                value={data.completedThisWeek}
              />
              <MatrixStatCard
                label="Average PM time"
                value={
                  data.averagePmTimeMinutes == null
                    ? "—"
                    : `${data.averagePmTimeMinutes} min`
                }
              />
              <MatrixStatCard
                label="Assigned machines"
                value={data.assignedMachines.length}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <MatrixCard title="Today's / Due work">
                <ul className="max-h-72 space-y-2 overflow-y-auto text-sm">
                  {todaysList.length === 0 ? (
                    <li className="text-slate-500">No due work right now.</li>
                  ) : (
                    todaysList.map((m) => (
                      <li
                        key={m.machineId}
                        className="flex items-start justify-between gap-2 border-b border-slate-800/50 pb-2"
                      >
                        <div>
                          <Link
                            href={`/maintenance/machines/${encodeURIComponent(m.machineId)}`}
                            className="font-medium text-cyan-300 hover:underline"
                          >
                            {m.nickname ?? m.machineId}
                          </Link>
                          <p className="text-xs text-slate-500">
                            {m.customerName ?? "—"} · meter{" "}
                            {m.currentMeterCount?.toLocaleString() ?? "—"}
                          </p>
                        </div>
                        <PmCleaningStatusBadge status={m.status} />
                      </li>
                    ))
                  )}
                </ul>
              </MatrixCard>

              <MatrixCard title="Overdue PMs">
                <ul className="max-h-72 space-y-2 overflow-y-auto text-sm">
                  {overdueList.length === 0 ? (
                    <li className="text-slate-500">None overdue.</li>
                  ) : (
                    overdueList.map((m) => (
                      <li key={m.machineId}>
                        <Link
                          href={`/maintenance/machines/${encodeURIComponent(m.machineId)}`}
                          className="text-cyan-300 hover:underline"
                        >
                          {m.nickname ?? m.machineId}
                        </Link>
                        <span className="ml-2 text-xs text-rose-300">
                          {m.countsOverdue?.toLocaleString() ?? "?"} over
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              </MatrixCard>

              <MatrixCard
                title="Assigned machines"
                className="lg:col-span-2"
                subtitle={data.technician}
              >
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-slate-800 text-xs uppercase text-slate-400">
                      <tr>
                        <th className="px-3 py-2">Machine</th>
                        <th className="px-3 py-2">Customer</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Remaining</th>
                        <th className="px-3 py-2">Last labor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.assignedMachines.map((m) => (
                        <tr
                          key={m.machineId}
                          className="border-t border-slate-800/70"
                        >
                          <td className="px-3 py-2">
                            <Link
                              href={`/maintenance/machines/${encodeURIComponent(m.machineId)}`}
                              className="text-cyan-300 hover:underline"
                            >
                              {m.nickname ?? m.machineId}
                            </Link>
                          </td>
                          <td className="px-3 py-2 text-slate-400">
                            {m.customerName ?? "—"}
                          </td>
                          <td className="px-3 py-2">
                            <PmCleaningStatusBadge status={m.status} />
                          </td>
                          <td className="px-3 py-2 tabular-nums">
                            {m.countsRemaining?.toLocaleString() ?? "—"}
                          </td>
                          <td className="px-3 py-2 tabular-nums">
                            {m.lastLaborMinutes != null
                              ? `${m.lastLaborMinutes}m`
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </MatrixCard>
            </div>
          </>
        ) : null}

        <div className="mt-8">
          <MatrixCard
            title="Matrix Assist"
            subtitle="Open guided diagnostics for an assigned machine."
            actions={
              <MatrixButton href="/ai-technician" variant="secondary" size="sm">
                Open Matrix Assist
              </MatrixButton>
            }
          >
            <p className="text-sm text-slate-400">
              Use Matrix Assist from a service call or machine page for full
              context. This shortcut opens the assistant workspace.
            </p>
          </MatrixCard>
        </div>
      </MatrixAuthGuard>
    </MatrixShell>
  );
}
