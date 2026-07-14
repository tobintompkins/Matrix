"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MatrixCard, MatrixStatCard } from "../ui";
import { fetchPmDashboard } from "@/lib/maintenance/pm-api-client";
import type { PmDashboardSummary } from "@/lib/maintenance/pm-prisma-repository";

const empty: PmDashboardSummary = {
  total: 0,
  notConfigured: 0,
  good: 0,
  dueSoon: 0,
  due: 0,
  overdue: 0,
  active: 0,
};

/** Compact PM summary for the main dashboard (Patch 45). */
export default function PmDashboardSummaryCard() {
  const [summary, setSummary] = useState<PmDashboardSummary>(empty);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetchPmDashboard()
      .then((data) => {
        if (cancelled) return;
        if (!data.ok || !data.summary) {
          setError(data.error ?? "PM summary unavailable");
          return;
        }
        setSummary(data.summary);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "PM summary unavailable");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <MatrixCard
      title="Preventive Maintenance"
      subtitle="Impression-meter PM status from Prisma."
      actions={
        <Link
          href="/maintenance"
          className="text-sm font-medium text-cyan-400 hover:underline"
        >
          Open Preventive Maintenance
        </Link>
      }
    >
      {error ? (
        <p className="text-sm text-slate-500">{error}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <MatrixStatCard
            label="Overdue"
            value={summary.overdue}
            status={summary.overdue > 0 ? "attention" : "ok"}
            className="p-4"
          />
          <MatrixStatCard
            label="Due"
            value={summary.due}
            status={summary.due > 0 ? "watch" : "ok"}
            className="p-4"
          />
          <MatrixStatCard
            label="Due Soon"
            value={summary.dueSoon}
            status={summary.dueSoon > 0 ? "watch" : "ok"}
            className="p-4"
          />
        </div>
      )}
    </MatrixCard>
  );
}
