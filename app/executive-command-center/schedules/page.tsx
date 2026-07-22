"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import {
  hasMatrixPermission,
  resolveMatrixRole,
} from "@/lib/auth/permissions";
import MatrixShell from "@/app/components/MatrixShell";
import MatrixAuthGuard from "@/app/components/MatrixAuthGuard";
import { MatrixButton, MatrixCard } from "@/app/components/ui";
import ExecutiveNav from "../ExecutiveNav";

type ScheduleItem = {
  id: string;
  name: string;
  period: string;
  format: string;
  enabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
};

function Body() {
  const { user } = useUser();
  const { role } = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );
  const canManage = hasMatrixPermission(role, "MANAGE_EXECUTIVE_REPORT_SCHEDULES");
  const router = useRouter();
  const searchParams = useSearchParams();
  const range = searchParams.get("range") || "LAST_30";
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [name, setName] = useState("Weekly executive report");
  const [period, setPeriod] = useState("WEEKLY");
  const [format, setFormat] = useState("csv");
  const [jobType, setJobType] = useState("REPORT");
  const [timezone, setTimezone] = useState("America/New_York");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/executive-command-center/schedules", {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Failed");
      setItems(json.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  async function createSchedule() {
    setMessage("");
    setError("");
    const res = await fetch("/api/executive-command-center/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, period, format, jobType, timezone, runHour: 6 }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setError(json.error ?? "Create failed");
      return;
    }
    setMessage("Schedule created.");
    await load();
  }

  async function runDue() {
    setMessage("");
    const res = await fetch("/api/executive-command-center/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "runDue" }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setError(json.error ?? "Run failed");
      return;
    }
    setMessage(`Ran ${json.ran} due schedule(s).`);
    await load();
  }

  async function toggle(id: string, enabled: boolean) {
    await fetch("/api/executive-command-center/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", id, enabled }),
    });
    await load();
  }

  async function remove(id: string) {
    await fetch("/api/executive-command-center/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    await load();
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-1 py-2">
      <header>
        <h1 className="text-2xl font-semibold text-slate-100">
          Scheduled reports
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Administrators can schedule daily, weekly, or monthly executive
          reports. Runs create in-app notifications (no external email blast).
        </p>
      </header>
      <ExecutiveNav
        range={range}
        onRangeChange={(next) => {
          const p = new URLSearchParams(searchParams.toString());
          p.set("range", next);
          router.push(`?${p.toString()}`);
        }}
      />
      {error ? (
        <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="text-sm text-emerald-300">{message}</p>
      ) : null}

      {canManage ? (
        <MatrixCard className="space-y-3 p-4">
          <h2 className="text-lg font-medium text-slate-100">Create schedule</h2>
          <div className="grid gap-2 sm:grid-cols-3">
            <input
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
            />
            <select
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            >
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
            <select
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
              value={format}
              onChange={(e) => setFormat(e.target.value)}
            >
              <option value="csv">CSV</option>
              <option value="excel">Excel</option>
              <option value="pdf">PDF</option>
            </select>
            <select
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
              value={jobType}
              onChange={(e) => setJobType(e.target.value)}
            >
              <option value="REPORT">Report</option>
              <option value="BRIEFING">Briefing</option>
              <option value="KPI_REFRESH">KPI refresh</option>
              <option value="ALERT_REFRESH">Alert refresh</option>
              <option value="CACHE_REFRESH">Cache refresh</option>
            </select>
            <input
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="Timezone"
            />
          </div>
          <p className="text-xs text-slate-500">
            Cron endpoint (when secret configured):{" "}
            <code className="text-slate-400">
              POST /api/internal/executive/run-scheduled
            </code>
          </p>
          <div className="flex flex-wrap gap-2">
            <MatrixButton type="button" onClick={() => void createSchedule()}>
              Create
            </MatrixButton>
            <MatrixButton type="button" variant="secondary" onClick={() => void runDue()}>
              Run due now
            </MatrixButton>
          </div>
        </MatrixCard>
      ) : (
        <p className="text-sm text-slate-500">
          You can view schedules. Creating or changing schedules requires manage
          permission.
        </p>
      )}

      {loading ? <div className="h-24 animate-pulse rounded-xl bg-slate-800/60" /> : null}
      <MatrixCard className="overflow-x-auto p-4">
        {items.length === 0 ? (
          <p className="text-sm text-slate-400">No schedules yet.</p>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-400">
              <tr>
                <th className="px-2 py-2">Name</th>
                <th className="px-2 py-2">Period</th>
                <th className="px-2 py-2">Format</th>
                <th className="px-2 py-2">Enabled</th>
                <th className="px-2 py-2">Next run</th>
                <th className="px-2 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id} className="border-t border-slate-800 text-slate-200">
                  <td className="px-2 py-2">{s.name}</td>
                  <td className="px-2 py-2">{s.period}</td>
                  <td className="px-2 py-2">{s.format}</td>
                  <td className="px-2 py-2">{s.enabled ? "Yes" : "No"}</td>
                  <td className="px-2 py-2 text-xs text-slate-500">
                    {s.nextRunAt ? new Date(s.nextRunAt).toLocaleString() : "—"}
                  </td>
                  <td className="px-2 py-2">
                    {canManage ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="text-xs text-cyan-300 hover:underline"
                          onClick={() => void toggle(s.id, !s.enabled)}
                        >
                          {s.enabled ? "Disable" : "Enable"}
                        </button>
                        <button
                          type="button"
                          className="text-xs text-rose-300 hover:underline"
                          onClick={() => void remove(s.id)}
                        >
                          Delete
                        </button>
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </MatrixCard>
    </div>
  );
}

export default function ExecutiveSchedulesPage() {
  return (
    <MatrixShell title="Scheduled reports" activePath="/executive-command-center">
      <MatrixAuthGuard requiredPermissions={["VIEW_EXECUTIVE_REPORTS"]}>
        <Suspense fallback={<p className="text-sm text-slate-400">Loading…</p>}>
          <Body />
        </Suspense>
      </MatrixAuthGuard>
    </MatrixShell>
  );
}
