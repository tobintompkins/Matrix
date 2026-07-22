"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import MatrixShell from "@/app/components/MatrixShell";
import MatrixAuthGuard from "@/app/components/MatrixAuthGuard";
import { MatrixButton, MatrixCard } from "@/app/components/ui";
import ExecutiveNav from "../ExecutiveNav";

type BriefingBundle = {
  period: string;
  periodLabel: string;
  dataFreshness: string;
  keyChanges: string[];
  briefing: {
    summary: string;
    priorities: Array<{ title: string; reason: string; href?: string; kind: string }>;
    isSample: boolean;
    confidence: number;
  };
  sections: Array<{
    key: string;
    title: string;
    body: string;
    href?: string;
    items?: Array<{ label: string; value: string; href?: string }>;
  }>;
  risks: Array<{ title: string; detail: string; href?: string }>;
};

function Body() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const range = searchParams.get("range") || "LAST_30";
  const period = searchParams.get("period") || "DAILY";
  const [data, setData] = useState<BriefingBundle | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams(searchParams.toString());
      qs.set("period", period);
      const res = await fetch(
        `/api/executive-command-center/briefings?${qs.toString()}`,
        { cache: "no-store" },
      );
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Failed");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, [period, searchParams]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  function setParam(key: string, value: string) {
    const p = new URLSearchParams(searchParams.toString());
    if (value) p.set(key, value);
    else p.delete(key);
    router.push(`?${p.toString()}`);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-1 py-2">
      <header>
        <h1 className="text-2xl font-semibold text-slate-100">
          Executive Briefing Center
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Period briefings grounded in live Matrix data — filters preserved in the
          URL. Sample AI when live providers are off.
        </p>
      </header>
      <ExecutiveNav range={range} onRangeChange={(n) => setParam("range", n)} />

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm text-slate-400">
          Period
          <select
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200"
            value={period}
            onChange={(e) => setParam("period", e.target.value)}
          >
            <option value="DAILY">Daily</option>
            <option value="WEEKLY">Weekly</option>
            <option value="MONTHLY">Monthly</option>
          </select>
        </label>
        {(
          [
            ["customer", "Customer"],
            ["site", "Site"],
            ["technician", "Technician"],
            ["model", "Model"],
            ["status", "Status"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="text-sm text-slate-400">
            {label}
            <input
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200"
              value={searchParams.get(key) || ""}
              onChange={(e) => setParam(key, e.target.value)}
              placeholder={label}
            />
          </label>
        ))}
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4">
          <p className="text-sm text-rose-200">{error}</p>
          <MatrixButton type="button" className="mt-3" onClick={() => void load()}>
            Retry
          </MatrixButton>
        </div>
      ) : null}
      {loading && !data ? (
        <div className="h-40 animate-pulse rounded-xl bg-slate-800/60" />
      ) : null}

      {data ? (
        <>
          <p className="text-xs text-slate-500">
            {data.periodLabel} · fresh {new Date(data.dataFreshness).toLocaleString()}
            {data.briefing.isSample ? " · sample AI" : ""} · confidence{" "}
            {data.briefing.confidence}%
          </p>
          <MatrixCard className="space-y-3 p-4">
            <h2 className="text-lg font-medium text-slate-100">Briefing</h2>
            <p className="text-sm text-slate-300">{data.briefing.summary}</p>
            <ul className="space-y-2 text-sm">
              {data.keyChanges.map((c) => (
                <li key={c} className="text-slate-400">
                  · {c}
                </li>
              ))}
            </ul>
          </MatrixCard>
          {data.risks.length > 0 ? (
            <MatrixCard className="p-4">
              <h2 className="text-lg font-medium text-slate-100">
                Critical operational risks
              </h2>
              <ul className="mt-3 space-y-2">
                {data.risks.map((r) => (
                  <li key={r.title} className="text-sm text-slate-300">
                    {r.href ? (
                      <Link href={r.href} className="text-cyan-300 hover:underline">
                        {r.title}
                      </Link>
                    ) : (
                      r.title
                    )}
                    <div className="text-xs text-slate-500">{r.detail}</div>
                  </li>
                ))}
              </ul>
            </MatrixCard>
          ) : null}
          <div className="grid gap-3 md:grid-cols-2">
            {data.sections.map((s) => (
              <MatrixCard key={s.key} className="p-4">
                <h2 className="text-lg font-medium text-slate-100">
                  {s.href ? (
                    <Link href={s.href} className="hover:text-cyan-300">
                      {s.title}
                    </Link>
                  ) : (
                    s.title
                  )}
                </h2>
                <p className="mt-2 text-sm text-slate-400">{s.body}</p>
                {s.items?.length ? (
                  <ul className="mt-3 space-y-1 text-sm text-slate-300">
                    {s.items.map((i) => (
                      <li key={`${i.label}-${i.value}`}>
                        {i.href ? (
                          <Link href={i.href} className="text-cyan-300 hover:underline">
                            {i.label}
                          </Link>
                        ) : (
                          i.label
                        )}
                        <span className="text-slate-500"> · {i.value}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </MatrixCard>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

export default function ExecutiveBriefingsPage() {
  return (
    <MatrixShell title="Executive Briefings" activePath="/executive-command-center">
      <MatrixAuthGuard requiredPermissions={["VIEW_EXECUTIVE_COMMAND_CENTER"]}>
        <Suspense fallback={<p className="text-sm text-slate-400">Loading…</p>}>
          <Body />
        </Suspense>
      </MatrixAuthGuard>
    </MatrixShell>
  );
}
