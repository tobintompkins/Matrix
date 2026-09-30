"use client";

import { useState } from "react";
import { buildTechnicianIdBackfillReviewCsv, type TechnicianIdCoverage } from "@/lib/field/technician-id-coverage";

export default function FieldTechnicianIdBackfillExportCard() {
  const [notice, setNotice] = useState("");
  async function download() {
    try {
      const response = await fetch("/api/field/technician-id-coverage", { cache: "no-store" });
      const body = (await response.json()) as { coverage?: TechnicianIdCoverage; error?: string };
      if (!response.ok || !body.coverage) throw new Error(body.error ?? "Could not load coverage for export.");
      const url = URL.createObjectURL(new Blob([buildTechnicianIdBackfillReviewCsv(body.coverage)], { type: "text/csv" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `matrix-technician-id-backfill-review-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      setNotice("Backfill review CSV downloaded.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not prepare the review export.");
    }
  }
  return (
    <section className="mb-5 rounded-xl border border-slate-700 bg-slate-900 p-4">
      <h2 className="font-semibold text-slate-100">Technician ID Backfill Review Export</h2>
      <p className="mt-1 text-xs text-slate-400">Download the name-fallback and unassigned work orders for review. This cannot change assignments.</p>
      <button type="button" onClick={() => void download()} className="mt-3 min-h-10 rounded-lg border border-cyan-700 px-3 text-xs font-semibold text-cyan-100">Download review CSV</button>
      {notice && <p className="mt-2 text-xs text-slate-400">{notice}</p>}
    </section>
  );
}
