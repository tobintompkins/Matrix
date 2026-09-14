"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import MatrixShell from "@/app/components/MatrixShell";
import MatrixAuthGuard from "@/app/components/MatrixAuthGuard";
import { MatrixButton, MatrixCard } from "@/app/components/ui";
import ExecutiveNav from "../ExecutiveNav";

type Preset = { id: string; label: string };
type Answer = {
  question: string;
  answer: string;
  observed: string[];
  interpretation: string[];
  sources: Array<{ label: string; href: string }>;
  isSample: boolean;
  confidence?: number;
  supportingRecords?: Array<{
    id: string;
    type: string;
    label: string;
    href?: string;
    detail?: string;
  }>;
  relatedReports?: Array<{ label: string; href: string }>;
  assumptions?: string[];
  recommendations?: Array<{
    id: string;
    title: string;
    rationale: string;
    priority: string;
    href?: string;
    executable: false;
  }>;
  fabricated?: false;
  generatedAt: string;
};

type WidgetDef = {
  key: string;
  title: string;
  description: string;
  href: string;
};

function Body() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const range = searchParams.get("range") || "LAST_30";
  const [presets, setPresets] = useState<Preset[]>([]);
  const [widgets, setWidgets] = useState<WidgetDef[]>([]);
  const [question, setQuestion] = useState(
    "What customers are at highest operational risk?",
  );
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      void fetch("/api/executive-command-center/insights/ask", { cache: "no-store" })
        .then((r) => r.json())
        .then((j) => {
          if (j.ok) setPresets(j.presets ?? []);
        })
        .catch(() => undefined);
      void fetch("/api/executive-command-center/copilot?view=widgets", {
        cache: "no-store",
      })
        .then((r) => r.json())
        .then((j) => {
          if (j.ok && j.widgets) setWidgets(j.widgets);
        })
        .catch(() => undefined);
    });
  }, []);

  const ask = useCallback(async (q: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/executive-command-center/insights/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Failed");
      setAnswer(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-1 py-2">
      <header>
        <h1 className="text-2xl font-semibold text-slate-100">
          Executive AI Copilot
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">
          Ask leadership questions against Matrix data only. Answers include
          confidence, supporting records, related reports, and assumptions.
          Matrix Assist may package wording — it never invents metrics. Actions
          are recommended, never executed.
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

      {widgets.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {widgets.map((w) => (
            <Link
              key={w.key}
              href={w.href}
              className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs text-slate-300 hover:border-cyan-500/40"
            >
              <span className="font-medium text-slate-100">{w.title}</span>
              <span className="mt-1 block text-slate-500">{w.description}</span>
            </Link>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-cyan-500/40"
            onClick={() => {
              setQuestion(p.label);
              void ask(p.label);
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
      <MatrixCard className="space-y-3 p-4">
        <textarea
          className="min-h-24 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <MatrixButton
            type="button"
            disabled={loading}
            onClick={() => void ask(question)}
          >
            {loading ? "Asking…" : "Ask Copilot"}
          </MatrixButton>
          <Link
            href="/executive-command-center/briefings?period=DAILY"
            className="self-center text-sm text-cyan-300 hover:underline"
          >
            Daily briefing →
          </Link>
          <Link
            href="/executive-command-center/report-center?period=WEEKLY"
            className="self-center text-sm text-cyan-300 hover:underline"
          >
            Weekly report →
          </Link>
        </div>
      </MatrixCard>
      {error ? <p className="text-sm text-rose-200">{error}</p> : null}
      {answer ? (
        <MatrixCard className="space-y-4 p-4">
          <div>
            <h2 className="text-lg font-medium text-slate-100">Answer</h2>
            <p className="mt-2 text-sm text-slate-300">{answer.answer}</p>
            <p className="mt-1 text-xs text-slate-500">
              Confidence {answer.confidence ?? "—"}% ·{" "}
              {answer.isSample ? "Deterministic / sample" : "Assist packaging"} ·{" "}
              fabricated: no · {new Date(answer.generatedAt).toLocaleString()}
            </p>
          </div>
          {(answer.assumptions ?? []).length > 0 ? (
            <div>
              <h3 className="text-sm font-medium text-slate-200">Assumptions</h3>
              <ul className="mt-2 space-y-1 text-sm text-slate-400">
                {answer.assumptions!.map((o) => (
                  <li key={o}>· {o}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {(answer.supportingRecords ?? []).length > 0 ? (
            <div>
              <h3 className="text-sm font-medium text-slate-200">
                Supporting records
              </h3>
              <ul className="mt-2 space-y-1 text-sm text-slate-400">
                {answer.supportingRecords!.map((r) => (
                  <li key={`${r.type}-${r.id}`}>
                    {r.href ? (
                      <Link href={r.href} className="text-cyan-300 hover:underline">
                        {r.label}
                      </Link>
                    ) : (
                      r.label
                    )}
                    <span className="text-slate-500">
                      {" "}
                      ({r.type}
                      {r.detail ? ` · ${r.detail}` : ""})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div>
            <h3 className="text-sm font-medium text-slate-200">Observed data</h3>
            <ul className="mt-2 space-y-1 text-sm text-slate-400">
              {answer.observed.map((o) => (
                <li key={o}>· {o}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-medium text-slate-200">
              Interpretation / Assist packaging
            </h3>
            <ul className="mt-2 space-y-1 text-sm text-slate-400">
              {answer.interpretation.map((o) => (
                <li key={o}>· {o}</li>
              ))}
            </ul>
          </div>
          {(answer.recommendations ?? []).length > 0 ? (
            <div>
              <h3 className="text-sm font-medium text-slate-200">
                Decision support (not executed)
              </h3>
              <ul className="mt-2 space-y-2 text-sm text-slate-400">
                {answer.recommendations!.map((r) => (
                  <li key={r.id}>
                    <span className="text-amber-200">{r.priority}</span>{" "}
                    {r.href ? (
                      <Link href={r.href} className="text-cyan-300 hover:underline">
                        {r.title}
                      </Link>
                    ) : (
                      r.title
                    )}
                    <p className="text-xs text-slate-500">{r.rationale}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2 text-sm">
            {(answer.relatedReports ?? answer.sources).map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className="text-cyan-300 hover:underline"
              >
                {s.label}
              </Link>
            ))}
          </div>
        </MatrixCard>
      ) : null}
    </div>
  );
}

export default function ExecutiveAiAskPage() {
  return (
    <MatrixShell
      title="Executive AI Copilot"
      activePath="/executive-command-center"
    >
      <MatrixAuthGuard requiredPermissions={["USE_EXECUTIVE_AI_INSIGHTS"]}>
        <Suspense fallback={<p className="text-sm text-slate-400">Loading…</p>}>
          <Body />
        </Suspense>
      </MatrixAuthGuard>
    </MatrixShell>
  );
}
