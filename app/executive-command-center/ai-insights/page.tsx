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
  generatedAt: string;
};

function Body() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const range = searchParams.get("range") || "LAST_30";
  const [presets, setPresets] = useState<Preset[]>([]);
  const [question, setQuestion] = useState("What needs attention today?");
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
          Executive AI Insights
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Ask operational questions. Observed facts are separated from
          interpretation. Deterministic fallback when live AI is off.
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
        <MatrixButton
          type="button"
          disabled={loading}
          onClick={() => void ask(question)}
        >
          {loading ? "Asking…" : "Ask"}
        </MatrixButton>
      </MatrixCard>
      {error ? <p className="text-sm text-rose-200">{error}</p> : null}
      {answer ? (
        <MatrixCard className="space-y-4 p-4">
          <div>
            <h2 className="text-lg font-medium text-slate-100">Answer</h2>
            <p className="mt-2 text-sm text-slate-300">{answer.answer}</p>
            <p className="mt-1 text-xs text-slate-500">
              {answer.isSample ? "Deterministic / sample" : "Live AI"} ·{" "}
              {new Date(answer.generatedAt).toLocaleString()}
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-slate-200">Observed data</h3>
            <ul className="mt-2 space-y-1 text-sm text-slate-400">
              {answer.observed.map((o) => (
                <li key={o}>· {o}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-medium text-slate-200">Interpretation</h3>
            <ul className="mt-2 space-y-1 text-sm text-slate-400">
              {answer.interpretation.map((o) => (
                <li key={o}>· {o}</li>
              ))}
            </ul>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            {answer.sources.map((s) => (
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
    <MatrixShell title="Executive AI Insights" activePath="/executive-command-center">
      <MatrixAuthGuard requiredPermissions={["USE_EXECUTIVE_AI_INSIGHTS"]}>
        <Suspense fallback={<p className="text-sm text-slate-400">Loading…</p>}>
          <Body />
        </Suspense>
      </MatrixAuthGuard>
    </MatrixShell>
  );
}
