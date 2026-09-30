"use client";

import { useState } from "react";
import type { TechnicianIdCoverage } from "@/lib/field/technician-id-coverage";
import { parseTechnicianIdMapping, previewTechnicianIdBackfill, type TechnicianIdBackfillPreview } from "@/lib/field/technician-id-backfill-preview";

export default function FieldTechnicianIdBackfillPreviewCard() {
  const [mapping, setMapping] = useState('{\n  "Technician Name": "clerk_user_id"\n}');
  const [preview, setPreview] = useState<TechnicianIdBackfillPreview | null>(null);
  const [notice, setNotice] = useState("");
  async function buildPreview() {
    try {
      const response = await fetch("/api/field/technician-id-coverage", { cache: "no-store" });
      const body = (await response.json()) as { coverage?: TechnicianIdCoverage; error?: string };
      if (!response.ok || !body.coverage) throw new Error(body.error ?? "Could not load coverage.");
      setPreview(previewTechnicianIdBackfill(body.coverage, parseTechnicianIdMapping(mapping)));
      setNotice("Preview created. No assignments were changed.");
    } catch (error) {
      setPreview(null);
      setNotice(error instanceof Error ? error.message : "Could not create preview.");
    }
  }
  return (
    <section className="mb-5 rounded-xl border border-slate-700 bg-slate-900 p-4">
      <h2 className="font-semibold text-slate-100">Technician ID Backfill Preview</h2>
      <p className="mt-1 text-xs text-slate-400">Paste approved name-to-Clerk-user-ID mappings. Preview only; this does not write data.</p>
      <textarea value={mapping} onChange={(event) => setMapping(event.target.value)} rows={4} className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 font-mono text-xs text-slate-100" />
      <button type="button" onClick={() => void buildPreview()} className="mt-2 min-h-10 rounded-lg border border-cyan-700 px-3 text-xs font-semibold text-cyan-100">Build no-write preview</button>
      {notice && <p className="mt-2 text-xs text-slate-400">{notice}</p>}
      {preview && <p className="mt-2 text-sm text-slate-200">Ready to map: <span className="font-semibold text-emerald-200">{preview.ready.length}</span> · Unresolved: <span className="font-semibold text-amber-200">{preview.unresolved.length}</span></p>}
    </section>
  );
}
