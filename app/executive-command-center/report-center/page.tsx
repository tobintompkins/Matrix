"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import MatrixShell from "@/app/components/MatrixShell";
import MatrixAuthGuard from "@/app/components/MatrixAuthGuard";
import {
  MatrixButton,
  MatrixCard,
  MatrixStatCard,
} from "@/app/components/ui";
import ExecutiveNav from "../ExecutiveNav";
import type { PeriodReportBundle } from "@/lib/executive-command-center/reporting-types";
import {
  ENTERPRISE_REPORT_SECTION_OPTIONS,
  defaultReportSections,
} from "@/lib/executive-command-center/report-sections";

const PERIODS = [
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "ANNUAL", label: "Annual" },
] as const;

function statusColor(status: string) {
  if (status === "excellent" || status === "good") return "text-emerald-300";
  if (status === "watch") return "text-amber-300";
  if (status === "critical") return "text-rose-300";
  return "text-slate-500";
}

function SavedConfigsAndHistory({ period }: { period: string }) {
  const [configs, setConfigs] = useState<Array<{ id: string; name: string; period: string }>>(
    [],
  );
  const [history, setHistory] = useState<
    Array<{ id: string; title: string; filename: string | null; createdAt: string }>
  >([]);
  const [saveName, setSaveName] = useState("");
  const [msg, setMsg] = useState("");
  const [sections, setSections] = useState<string[]>(() => defaultReportSections());

  const reload = useCallback(async () => {
    const [c, h] = await Promise.all([
      fetch("/api/executive-command-center/report-configs", { cache: "no-store" }).then((r) =>
        r.json(),
      ),
      fetch("/api/executive-command-center/report-configs?kind=history", {
        cache: "no-store",
      }).then((r) => r.json()),
    ]);
    if (c.ok) setConfigs(c.items ?? []);
    if (h.ok) setHistory(h.items ?? []);
  }, []);

  useEffect(() => {
    queueMicrotask(() => void reload());
  }, [reload]);

  function toggleSection(key: string) {
    setSections((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  async function save() {
    setMsg("");
    const res = await fetch("/api/executive-command-center/report-configs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: saveName || `${period} saved config`,
        period,
        format: "csv",
        sections,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setMsg(json.error ?? "Save failed");
      return;
    }
    setSaveName("");
    setMsg("Configuration saved.");
    await reload();
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <MatrixCard className="space-y-3 p-4">
        <h2 className="text-lg font-medium text-slate-100">Report builder</h2>
        <p className="text-xs text-slate-500">
          Choose sections to include in saved configurations. Exports use CSV /
          Excel XML / PDF-text hooks.
        </p>
        <div className="grid max-h-48 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
          {ENTERPRISE_REPORT_SECTION_OPTIONS.map((opt) => (
            <label
              key={opt.key}
              className="flex items-center gap-2 text-xs text-slate-300"
            >
              <input
                type="checkbox"
                checked={sections.includes(opt.key)}
                onChange={() => toggleSection(opt.key)}
              />
              {opt.label}
            </label>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="Config name"
          />
          <MatrixButton type="button" onClick={() => void save()}>
            Save
          </MatrixButton>
        </div>
        {msg ? <p className="text-xs text-emerald-300">{msg}</p> : null}
        <ul className="space-y-1 text-sm text-slate-400">
          {configs.length === 0 ? <li>No saved configs yet.</li> : null}
          {configs.map((c) => (
            <li key={c.id}>
              {c.name} · {c.period}
            </li>
          ))}
        </ul>
      </MatrixCard>
      <MatrixCard className="space-y-3 p-4">
        <h2 className="text-lg font-medium text-slate-100">Report history</h2>
        <ul className="space-y-1 text-sm text-slate-400">
          {history.length === 0 ? <li>No exports yet.</li> : null}
          {history.map((h) => (
            <li key={h.id}>
              {h.title}
              {h.filename ? ` · ${h.filename}` : ""} ·{" "}
              {new Date(h.createdAt).toLocaleString()}
            </li>
          ))}
        </ul>
      </MatrixCard>
    </div>
  );
}

function Body() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const range = searchParams.get("range") || "LAST_30";
  const period = searchParams.get("period") || "WEEKLY";
  const [report, setReport] = useState<PeriodReportBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/executive-command-center/reporting?period=${encodeURIComponent(period)}&refresh=1`,
        { cache: "no-store" },
      );
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Failed to load report");
      setReport(json.report);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  function setPeriod(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", next);
    router.push(`?${params.toString()}`);
  }

  function setRange(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", next);
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-1 py-2">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">
            Report Builder
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Period reports, section configs, AI summaries, KPI scorecards, and
            CSV / Excel / PDF-text exports from live Matrix data.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["csv", "excel", "pdf"] as const).map((fmt) => (
            <a
              key={fmt}
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-cyan-300 hover:border-cyan-500/40"
              href={`/api/executive-command-center/reporting/export?period=${encodeURIComponent(period)}&format=${fmt}`}
            >
              Export {fmt.toUpperCase()}
            </a>
          ))}
        </div>
      </header>

      <ExecutiveNav range={range} onRangeChange={setRange} />

      <label className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
        Report period
        <select
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-slate-200"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
        >
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <MatrixButton type="button" variant="secondary" onClick={() => void load()}>
          Refresh
        </MatrixButton>
      </label>

      {error ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4" role="alert">
          <p className="text-sm text-rose-200">{error}</p>
          <MatrixButton type="button" className="mt-3" onClick={() => void load()}>
            Retry
          </MatrixButton>
        </div>
      ) : null}

      {loading && !report ? (
        <div className="h-40 animate-pulse rounded-xl bg-slate-800/60" aria-busy="true" />
      ) : null}

      {report ? (
        <>
          <p className="text-xs text-slate-500">
            {report.periodLabel} · {new Date(report.generatedAt).toLocaleString()}
            {report.cacheHit ? " · cached" : ""}
          </p>

          <MatrixCard className="space-y-3 p-4">
            <h2 className="text-lg font-medium text-slate-100">
              AI Executive Summary
            </h2>
            <p className="text-sm text-slate-300">{report.aiSummary.summary}</p>
            <ul className="space-y-2">
              {report.aiSummary.sections.map((s) => (
                <li key={s.title} className="rounded-lg border border-slate-800 px-3 py-2 text-sm">
                  <span className="text-[10px] uppercase text-slate-500">
                    {s.kind === "fact" ? "Fact" : "Recommendation"}
                  </span>
                  <div className="font-medium text-slate-200">{s.title}</div>
                  <p className="text-xs text-slate-400">{s.body}</p>
                </li>
              ))}
            </ul>
            <p className="text-xs text-slate-500">
              {report.aiSummary.isSample
                ? "Sample / local template — no paid AI required"
                : `${report.aiSummary.provider}/${report.aiSummary.model}`}{" "}
              · confidence {report.aiSummary.confidence}%
            </p>
          </MatrixCard>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {report.scorecards.slice(0, 4).map((s) => (
              <MatrixStatCard
                key={s.key}
                label={s.label}
                value={s.available ? String(s.value) : "—"}
                status={
                  s.status === "critical"
                    ? "attention"
                    : s.status === "watch"
                      ? "watch"
                      : s.status === "unavailable"
                        ? "unavailable"
                        : "ok"
                }
                trend={s.detail}
              />
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <MatrixCard className="p-4">
              <h2 className="mb-3 text-lg font-medium text-slate-100">
                KPI scorecards
              </h2>
              <ul className="space-y-2 text-sm">
                {report.scorecards.map((s) => (
                  <li key={s.key} className="flex justify-between gap-3 border-t border-slate-800 pt-2">
                    <span>
                      {s.label}
                      <span className="block text-xs text-slate-500">{s.detail}</span>
                    </span>
                    <span className={statusColor(s.status)}>
                      {s.available ? String(s.value) : "n/a"}
                    </span>
                  </li>
                ))}
              </ul>
              <Link
                href={`/executive-command-center/scorecards?period=${period}&range=${range}`}
                className="mt-3 inline-block text-xs text-cyan-300 hover:underline"
              >
                Open scorecards →
              </Link>
            </MatrixCard>

            <MatrixCard className="p-4">
              <h2 className="mb-3 text-lg font-medium text-slate-100">
                Period comparison
              </h2>
              <ul className="space-y-2 text-sm text-slate-300">
                {report.comparisons.map((c) => (
                  <li key={c.metric} className="border-t border-slate-800 pt-2">
                    <div className="font-medium text-slate-200">{c.metric}</div>
                    <div className="text-xs text-slate-500">
                      {c.previous} → {c.current} ({c.direction}
                      {c.deltaPercent != null ? `, ${c.deltaPercent}%` : ""})
                    </div>
                  </li>
                ))}
              </ul>
              <Link
                href={`/executive-command-center/comparisons?range=${range}`}
                className="mt-3 inline-block text-xs text-cyan-300 hover:underline"
              >
                Open trend comparisons →
              </Link>
            </MatrixCard>
          </div>

          <MatrixCard className="p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-medium text-slate-100">
                Dashboard widgets
              </h2>
              <Link
                href={`/executive-command-center/widgets?period=${period}&range=${range}`}
                className="text-xs text-cyan-300 hover:underline"
              >
                Full widgets →
              </Link>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {report.widgets.slice(0, 6).map((w) => (
                <div key={w.key} className="rounded-lg border border-slate-800 p-3">
                  <h3 className="text-sm font-medium text-slate-200">{w.title}</h3>
                  {w.empty ? (
                    <p className="mt-2 text-xs text-slate-500">{w.emptyMessage}</p>
                  ) : (
                    <ul className="mt-2 space-y-1 text-xs text-slate-400">
                      {w.rows.slice(0, 3).map((r) => (
                        <li key={r.id}>
                          {r.href ? (
                            <Link href={r.href} className="text-cyan-300 hover:underline">
                              {r.label}
                            </Link>
                          ) : (
                            r.label
                          )}
                          : {r.value}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </MatrixCard>

          <SavedConfigsAndHistory period={period} />

          <p className="text-sm text-slate-400">
            Manage schedules in{" "}
            <Link
              href={`/executive-command-center/schedules?range=${range}`}
              className="text-cyan-300 hover:underline"
            >
              Scheduled Reports
            </Link>
            .
          </p>
        </>
      ) : null}
    </div>
  );
}

export default function ExecutiveReportCenterPage() {
  return (
    <MatrixShell title="Executive Report Center" activePath="/executive-command-center">
      <MatrixAuthGuard
        requiredPermissions={["VIEW_EXECUTIVE_REPORTS", "VIEW_EXECUTIVE_COMMAND_CENTER"]}
      >
        <Suspense fallback={<p className="text-sm text-slate-400">Loading…</p>}>
          <Body />
        </Suspense>
      </MatrixAuthGuard>
    </MatrixShell>
  );
}
