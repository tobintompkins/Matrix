"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MatrixShell from "@/app/components/MatrixShell";
import MatrixAuthGuard from "@/app/components/MatrixAuthGuard";
import { MatrixButton, MatrixCard } from "@/app/components/ui";
import ExecutiveNav from "../ExecutiveNav";
import type { TrendComparisonRow } from "@/lib/executive-command-center/reporting-types";

const MODES = [
  { value: "WEEK_VS_PREV", label: "This week vs last week" },
  { value: "MONTH_VS_PREV", label: "Month vs previous month" },
  { value: "QUARTER_VS_PREV", label: "Quarter vs previous quarter" },
  { value: "YEAR_VS_PREV", label: "Year over year" },
];

function Body() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const range = searchParams.get("range") || "LAST_30";
  const mode = searchParams.get("mode") || "WEEK_VS_PREV";
  const [rows, setRows] = useState<TrendComparisonRow[]>([]);
  const [meta, setMeta] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/executive-command-center/comparisons?mode=${encodeURIComponent(mode)}`,
        { cache: "no-store" },
      );
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Failed");
      setRows(json.comparisons ?? []);
      setMeta(
        `${json.mode} · ${new Date(json.generatedAt).toLocaleString()}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-1 py-2">
      <header>
        <h1 className="text-2xl font-semibold text-slate-100">
          Trend comparisons
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Compare current and previous windows using real service activity.
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
      <label className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
        Comparison
        <select
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-slate-200"
          value={mode}
          onChange={(e) => {
            const p = new URLSearchParams(searchParams.toString());
            p.set("mode", e.target.value);
            router.push(`?${p.toString()}`);
          }}
        >
          {MODES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      {error ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4">
          <p className="text-sm text-rose-200">{error}</p>
          <MatrixButton type="button" className="mt-3" onClick={() => void load()}>
            Retry
          </MatrixButton>
        </div>
      ) : null}
      {loading ? <div className="h-32 animate-pulse rounded-xl bg-slate-800/60" /> : null}
      {!loading && rows.length === 0 ? (
        <MatrixCard className="p-6">
          <p className="text-sm text-slate-400">No comparison metrics available.</p>
        </MatrixCard>
      ) : null}
      {rows.length > 0 ? (
        <MatrixCard className="overflow-x-auto p-4">
          <p className="mb-3 text-xs text-slate-500">{meta}</p>
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-400">
              <tr>
                <th className="px-2 py-2">Metric</th>
                <th className="px-2 py-2">Previous</th>
                <th className="px-2 py-2">Current</th>
                <th className="px-2 py-2">Delta</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.metric} className="border-t border-slate-800 text-slate-200">
                  <td className="px-2 py-2">{r.metric}</td>
                  <td className="px-2 py-2">{r.previous}</td>
                  <td className="px-2 py-2">{r.current}</td>
                  <td className="px-2 py-2">
                    {r.delta} ({r.direction}
                    {r.deltaPercent != null ? `, ${r.deltaPercent}%` : ""})
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </MatrixCard>
      ) : null}
    </div>
  );
}

export default function ExecutiveComparisonsPage() {
  return (
    <MatrixShell title="Trend comparisons" activePath="/executive-command-center">
      <MatrixAuthGuard requiredPermissions={["VIEW_EXECUTIVE_REPORTS"]}>
        <Suspense fallback={<p className="text-sm text-slate-400">Loading…</p>}>
          <Body />
        </Suspense>
      </MatrixAuthGuard>
    </MatrixShell>
  );
}
