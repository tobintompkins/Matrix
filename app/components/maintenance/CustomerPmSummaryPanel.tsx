"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MatrixCard, MatrixStatCard } from "@/app/components/ui";
import { fetchCustomerPmSummary } from "@/lib/maintenance/pm-api-client";

type Props = {
  customerName: string;
};

export default function CustomerPmSummaryPanel({ customerName }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<{
    totalMachines: number;
    pmDue: number;
    pmOverdue: number;
    lastPmCompleted: string | null;
    lastPmTechnician: string | null;
    nextScheduledHint: {
      machineId: string;
      nickname: string | null;
      nextPmDueCount: number | null;
      countsRemaining: number | null;
      status: string;
    } | null;
    fleetHealth: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetchCustomerPmSummary(customerName);
        if (cancelled) return;
        if (!res.ok || !res.data) {
          setError(res.error ?? "Unable to load PM summary");
          setData(null);
          return;
        }
        setData(res.data);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Unable to load PM summary");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [customerName]);

  return (
    <MatrixCard
      title="Preventive Maintenance Summary"
      subtitle="Fleet PM health from the Patch 45/46 PM module"
      className="mb-8"
    >
      {loading ? (
        <p className="text-sm text-slate-500">Loading PM summary…</p>
      ) : error ? (
        <p className="text-sm text-rose-300">{error}</p>
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <MatrixStatCard label="Total machines" value={data.totalMachines} />
            <MatrixStatCard label="PM due" value={data.pmDue} />
            <MatrixStatCard
              label="PM overdue"
              value={data.pmOverdue}
              accent="text-rose-400"
            />
            <MatrixStatCard
              label="Last PM completed"
              value={
                data.lastPmCompleted
                  ? new Date(data.lastPmCompleted).toLocaleDateString()
                  : "—"
              }
            />
            <MatrixStatCard
              label="Next scheduled PM"
              value={
                data.nextScheduledHint
                  ? data.nextScheduledHint.nickname ??
                    data.nextScheduledHint.machineId
                  : "—"
              }
            />
            <MatrixStatCard
              label="Fleet health"
              value={data.fleetHealth}
              accent={
                data.fleetHealth === "Healthy"
                  ? "text-emerald-400"
                  : data.fleetHealth === "Attention required"
                    ? "text-rose-400"
                    : "text-amber-300"
              }
            />
          </div>
          {data.nextScheduledHint ? (
            <p className="mt-4 text-sm text-slate-400">
              Next focus:{" "}
              <Link
                href={`/maintenance/machines/${encodeURIComponent(data.nextScheduledHint.machineId)}`}
                className="text-cyan-300 hover:underline"
              >
                {data.nextScheduledHint.nickname ??
                  data.nextScheduledHint.machineId}
              </Link>
              {data.nextScheduledHint.countsRemaining != null
                ? ` · ${data.nextScheduledHint.countsRemaining.toLocaleString()} counts remaining`
                : ""}
              {data.lastPmTechnician
                ? ` · last tech ${data.lastPmTechnician}`
                : ""}
            </p>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-slate-500">No PM data for this customer.</p>
      )}
    </MatrixCard>
  );
}
