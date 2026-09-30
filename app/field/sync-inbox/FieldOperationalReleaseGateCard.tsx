"use client";

import { useCallback, useEffect, useState } from "react";
import type { FieldOperationalReleaseGate } from "@/lib/field/field-operational-release-gate";

export default function FieldOperationalReleaseGateCard() {
  const [gate, setGate] = useState<FieldOperationalReleaseGate | null>(null);
  const [notice, setNotice] = useState("Loading Field operational release gate…");
  const fetchGate = useCallback(async (): Promise<FieldOperationalReleaseGate> => {
    const response = await fetch("/api/field/operational-release-gate", { cache: "no-store" });
    const body = (await response.json()) as { gate?: FieldOperationalReleaseGate; error?: string };
    if (!response.ok || !body.gate) {
      throw new Error(body.error ?? "Could not load Field operational release gate.");
    }
    return body.gate;
  }, []);

  const load = useCallback(async () => {
    setNotice("Loading Field operational release gate…");
    try {
      setGate(await fetchGate());
      setNotice("");
    } catch (error) {
      setGate(null);
      setNotice(error instanceof Error ? error.message : "Could not load Field operational release gate.");
    }
  }, [fetchGate]);

  useEffect(() => {
    let active = true;
    void fetchGate()
      .then((nextGate) => {
        if (!active) return;
        setGate(nextGate);
        setNotice("");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setGate(null);
        setNotice(
          error instanceof Error ? error.message : "Could not load Field operational release gate.",
        );
      });
    return () => {
      active = false;
    };
  }, [fetchGate]);

  return (
    <section className={`mb-5 rounded-xl border p-4 ${gate?.state === "ready" ? "border-emerald-800/60 bg-emerald-950/30" : "border-amber-800/60 bg-amber-950/30"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-100">Field Operational Release Gate</h2>
          <p className="mt-1 text-xs text-slate-400">Advisory only. It does not enable the Field bridge or modify data.</p>
        </div>
        <button type="button" onClick={() => void load()} className="min-h-10 rounded-lg border border-slate-600 px-3 text-xs font-semibold text-slate-200">Refresh gate</button>
      </div>
      {notice && <p className="mt-3 text-sm text-slate-300">{notice}</p>}
      {gate && <div className="mt-3 text-sm text-slate-200">
        <p className={gate.state === "ready" ? "font-semibold text-emerald-200" : "font-semibold text-amber-200"}>{gate.headline}</p>
        {gate.reasons.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-100">{gate.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>}
        <p className="mt-3 text-xs text-slate-400">Verification: {gate.readiness.state} · Decision: {gate.latestDecision.status} · Waiting: {gate.syncHealth.received} · Review: {gate.syncHealth.rejected}</p>
      </div>}
    </section>
  );
}
