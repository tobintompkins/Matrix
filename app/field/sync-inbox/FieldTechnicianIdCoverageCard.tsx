"use client";

import { useCallback, useEffect, useState } from "react";
import type { TechnicianIdCoverage } from "@/lib/field/technician-id-coverage";

export default function FieldTechnicianIdCoverageCard() {
  const [coverage, setCoverage] = useState<TechnicianIdCoverage | null>(null);
  const [notice, setNotice] = useState("Loading technician assignment coverage…");
  const fetchCoverage = useCallback(async (): Promise<TechnicianIdCoverage> => {
    const response = await fetch("/api/field/technician-id-coverage", { cache: "no-store" });
    const body = (await response.json()) as { coverage?: TechnicianIdCoverage; error?: string };
    if (!response.ok || !body.coverage) {
      throw new Error(body.error ?? "Could not load technician assignment coverage.");
    }
    return body.coverage;
  }, []);

  const load = useCallback(async () => {
    setNotice("Loading technician assignment coverage…");
    try {
      setCoverage(await fetchCoverage());
      setNotice("");
    } catch (error) {
      setCoverage(null);
      setNotice(error instanceof Error ? error.message : "Could not load technician assignment coverage.");
    }
  }, [fetchCoverage]);

  useEffect(() => {
    let active = true;
    void fetchCoverage()
      .then((nextCoverage) => {
        if (!active) return;
        setCoverage(nextCoverage);
        setNotice("");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setCoverage(null);
        setNotice(
          error instanceof Error ? error.message : "Could not load technician assignment coverage.",
        );
      });
    return () => {
      active = false;
    };
  }, [fetchCoverage]);

  return (
    <section className="mb-5 rounded-xl border border-slate-700 bg-slate-900 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="font-semibold text-slate-100">Technician Assignment ID Coverage</h2><p className="mt-1 text-xs text-slate-400">Read-only preparation for production ID backfill. Name matching remains unchanged.</p></div>
        <button type="button" onClick={() => void load()} className="min-h-10 rounded-lg border border-slate-600 px-3 text-xs font-semibold text-slate-200">Refresh coverage</button>
      </div>
      {notice && <p className="mt-3 text-sm text-slate-300">{notice}</p>}
      {coverage && <div className="mt-3 text-sm text-slate-200">
        <p>Work orders checked: <span className="font-semibold">{coverage.totalWorkOrders}</span> · Primary IDs: <span className="font-semibold text-emerald-200">{coverage.primaryIdAssigned}</span> · Secondary IDs: <span className="font-semibold text-emerald-200">{coverage.secondaryIdAssigned}</span></p>
        <p className={coverage.nameFallbackWorkOrders.length === 0 ? "mt-2 text-emerald-200" : "mt-2 text-amber-200"}>{coverage.nameFallbackWorkOrders.length === 0 ? "No primary assignments require name fallback." : `${coverage.nameFallbackWorkOrders.length} primary assignment(s) still use name fallback.`}</p>
        {coverage.nameFallbackWorkOrders.slice(0, 12).map((item) => <p key={item.id} className="mt-1 text-xs text-slate-400">{item.workOrderNumber} · {item.technicianName}</p>)}
        {coverage.unassignedWorkOrders.length > 0 && <p className="mt-2 text-xs text-amber-200">{coverage.unassignedWorkOrders.length} work order(s) have no technician assignment.</p>}
      </div>}
    </section>
  );
}
