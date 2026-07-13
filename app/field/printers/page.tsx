"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import FieldShell from "../FieldShell";
import { listMaintenanceProfiles } from "@/lib/maintenance";

export default function FieldPrintersPage() {
  const [q, setQ] = useState("");
  const profiles = useMemo(() => listMaintenanceProfiles(), []);

  const filtered = profiles.filter((p) => {
    const s = q.toLowerCase();
    if (!s) return true;
    return (
      p.nickname.toLowerCase().includes(s) ||
      p.assetTag.toLowerCase().includes(s) ||
      p.customerName.toLowerCase().includes(s) ||
      p.printerModel.toLowerCase().includes(s) ||
      p.siteName.toLowerCase().includes(s)
    );
  });

  return (
    <FieldShell title="Printers">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search printer, customer, asset…"
        className="mb-4 min-h-12 w-full rounded-xl border border-slate-700 bg-slate-900 px-4"
        aria-label="Search printers"
      />
      <ul className="space-y-3">
        {filtered.slice(0, 40).map((p) => (
          <li key={p.printerId}>
            <Link
              href={`/field/printers/${p.printerId}`}
              className="block rounded-2xl border border-slate-800 bg-slate-900 p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
            >
              <p className="font-semibold text-white">{p.nickname || p.assetTag}</p>
              <p className="text-sm text-slate-400">
                {p.customerName} · {p.siteName}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {p.printerModel} · {p.assetTag} · Count{" "}
                {p.currentCopyCount?.toLocaleString() ?? "—"}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </FieldShell>
  );
}
