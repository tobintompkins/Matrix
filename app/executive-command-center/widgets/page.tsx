"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import MatrixShell from "@/app/components/MatrixShell";
import MatrixAuthGuard from "@/app/components/MatrixAuthGuard";
import { MatrixButton, MatrixCard } from "@/app/components/ui";
import ExecutiveNav from "../ExecutiveNav";
import type { DashboardWidget } from "@/lib/executive-command-center/reporting-types";

function Body() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const range = searchParams.get("range") || "LAST_30";
  const period = searchParams.get("period") || "WEEKLY";
  const page = Number(searchParams.get("page") || "1");
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/executive-command-center/reporting?period=${encodeURIComponent(period)}&page=${page}&pageSize=8`,
        { cache: "no-store" },
      );
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Failed");
      setWidgets(json.report.widgets ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, [period, page]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-1 py-2">
      <header>
        <h1 className="text-2xl font-semibold text-slate-100">
          Dashboard widgets
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Lazy-loaded widget panels with pagination from the reporting bundle.
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
      <div className="flex gap-2">
        <MatrixButton
          type="button"
          variant="secondary"
          disabled={page <= 1}
          onClick={() => {
            const p = new URLSearchParams(searchParams.toString());
            p.set("page", String(Math.max(1, page - 1)));
            router.push(`?${p.toString()}`);
          }}
        >
          Previous page
        </MatrixButton>
        <MatrixButton
          type="button"
          variant="secondary"
          onClick={() => {
            const p = new URLSearchParams(searchParams.toString());
            p.set("page", String(page + 1));
            router.push(`?${p.toString()}`);
          }}
        >
          Next page
        </MatrixButton>
      </div>
      {error ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4">
          <p className="text-sm text-rose-200">{error}</p>
          <MatrixButton type="button" className="mt-3" onClick={() => void load()}>
            Retry
          </MatrixButton>
        </div>
      ) : null}
      {loading ? <div className="h-40 animate-pulse rounded-xl bg-slate-800/60" /> : null}
      <div className="grid gap-3 md:grid-cols-2">
        {widgets.map((w) => (
          <MatrixCard key={w.key} className="p-4">
            <h2 className="text-lg font-medium text-slate-100">{w.title}</h2>
            <p className="text-xs text-slate-500">
              Page {w.page} · showing {w.rows.length} of {w.total}
            </p>
            {w.empty ? (
              <p className="mt-3 text-sm text-slate-400">{w.emptyMessage}</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm text-slate-300">
                {w.rows.map((r) => (
                  <li key={r.id} className="border-t border-slate-800 pt-2">
                    {r.href ? (
                      <Link href={r.href} className="text-cyan-300 hover:underline">
                        {r.label}
                      </Link>
                    ) : (
                      r.label
                    )}
                    <div className="text-xs text-slate-500">
                      {r.value}
                      {r.secondary ? ` · ${r.secondary}` : ""}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </MatrixCard>
        ))}
      </div>
    </div>
  );
}

export default function ExecutiveWidgetsPage() {
  return (
    <MatrixShell title="Dashboard widgets" activePath="/executive-command-center">
      <MatrixAuthGuard requiredPermissions={["VIEW_EXECUTIVE_REPORTS"]}>
        <Suspense fallback={<p className="text-sm text-slate-400">Loading…</p>}>
          <Body />
        </Suspense>
      </MatrixAuthGuard>
    </MatrixShell>
  );
}
