"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import MatrixShell from "../../../components/MatrixShell";
import MatrixAuthGuard from "../../../components/MatrixAuthGuard";
import { MatrixCard } from "../../../components/ui";
import PredictiveNav from "../PredictiveNav";

export default function PredictiveDataReadinessPage() {
  const [summary, setSummary] = useState<{ total: number; ready: number; notReady: number } | null>(null);
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      const res = await fetch(
        "/api/ai-operations/predictive-maintenance/data-readiness",
        { cache: "no-store" },
      );
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Failed");
        return;
      }
      setSummary(json.summary);
      setItems(json.items);
      setLinks(json.links ?? {});
    })();
  }, []);

  return (
    <MatrixShell title="Data Readiness" activePath="/ai-operations/predictive-maintenance">
      <MatrixAuthGuard requiredPermissions={["VIEW_PREDICTIVE_MAINTENANCE"]}>
        <PredictiveNav />
        <MatrixCard
          title="Fleet predictive data readiness"
          subtitle="Reuse Data Quality Center for corrections — not a duplicate DQ system"
        >
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          {summary ? (
            <p className="mb-4 text-sm text-slate-300">
              {summary.ready} ready / {summary.notReady} need data · {summary.total} machines
            </p>
          ) : null}
          <div className="mb-4 flex flex-wrap gap-3 text-sm">
            {links.dataQualityCenter ? (
              <Link className="text-cyan-300 hover:underline" href={links.dataQualityCenter}>
                Data Quality Center
              </Link>
            ) : null}
            {links.meterEntry ? (
              <Link className="text-cyan-300 hover:underline" href={links.meterEntry}>
                Meter entry
              </Link>
            ) : null}
            {links.pmSettings ? (
              <Link className="text-cyan-300 hover:underline" href={links.pmSettings}>
                PM settings
              </Link>
            ) : null}
          </div>
          <ul className="space-y-2">
            {items.map((row) => (
              <li
                key={String(row.machineId)}
                className="rounded-lg border border-slate-800 px-3 py-2 text-sm"
              >
                <Link
                  href={`/ai-operations/predictive-maintenance/machines/${row.machineId}`}
                  className="font-medium text-cyan-300 hover:underline"
                >
                  {String(row.machineId)}
                </Link>
                <span className="ml-2 text-slate-400">score {String(row.score)}</span>
                <span className="ml-2 text-xs text-amber-200">
                  {row.ready ? "Ready" : "Not ready"}
                </span>
                {Array.isArray(row.missingFields) && row.missingFields.length ? (
                  <p className="text-xs text-slate-500">
                    Missing: {(row.missingFields as string[]).join(", ")}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </MatrixCard>
      </MatrixAuthGuard>
    </MatrixShell>
  );
}
