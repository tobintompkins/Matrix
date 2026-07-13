import Link from "next/link";
import type { ReactNode } from "react";
import {
  computeFleetMaintenanceSummary,
  formatCopyCount,
  getMaintenanceStatusLabel,
  sampleMaintenanceProfiles,
} from "@/lib/maintenance";
import { MatrixCard } from "@/app/components/ui";

/**
 * Fleet maintenance summary — real status calculations from maintenance profiles.
 */
export default function FleetCopyCountsCard() {
  const stats = computeFleetMaintenanceSummary(sampleMaintenanceProfiles);

  return (
    <MatrixCard
      title="Fleet Copy Counts"
      subtitle="Maintenance status and copy-count metrics from calculated profiles."
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Mini label="Total printers" value={String(stats.totalPrinters)} />
        <Mini label="Current" value={String(stats.printersCurrent)} />
        <Mini label="Due soon" value={String(stats.printersDueSoon)} />
        <Mini label="Due" value={String(stats.printersDue)} />
        <Mini
          label="Overdue"
          value={String(stats.printersOverdue)}
          accent="text-rose-300"
        />
        <Mini
          label="Setup required"
          value={String(stats.printersSetupRequired)}
          accent="text-slate-300"
        />
      </div>

      {stats.insufficientData && (
        <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          Insufficient copy-count data for average/total fleet metrics.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Stat
          label="Highest current copy count"
          value={
            stats.highest ? (
              <>
                <Link
                  href={`/digital-twin/${stats.highest.printerId}`}
                  className="text-cyan-300 hover:text-cyan-200"
                >
                  {stats.highest.assetTag}
                </Link>
                <span className="mt-1 block text-2xl font-bold text-white">
                  {formatCopyCount(stats.highest.count)}
                </span>
              </>
            ) : (
              "Insufficient data"
            )
          }
        />
        <Stat
          label="Lowest current copy count"
          value={
            stats.lowest ? (
              <>
                <Link
                  href={`/digital-twin/${stats.lowest.printerId}`}
                  className="text-cyan-300 hover:text-cyan-200"
                >
                  {stats.lowest.assetTag}
                </Link>
                <span className="mt-1 block text-2xl font-bold text-white">
                  {formatCopyCount(stats.lowest.count)}
                </span>
              </>
            ) : (
              "Insufficient data"
            )
          }
        />
        <Stat
          label="Average fleet copy count"
          value={
            <span className="text-2xl font-bold text-white">
              {stats.averageFleetCount === null
                ? "Insufficient data"
                : formatCopyCount(stats.averageFleetCount)}
            </span>
          }
        />
        <Stat
          label="Total recorded fleet copies"
          value={
            <span className="text-2xl font-bold text-cyan-300">
              {stats.totalFleetCopies === null
                ? "Insufficient data"
                : formatCopyCount(stats.totalFleetCopies)}
            </span>
          }
        />
      </div>
      <p className="mt-4 text-xs text-slate-500">
        Averages exclude printers without valid copy counts (
        {stats.machinesWithCounts} included). Status labels:{" "}
        {getMaintenanceStatusLabel("CURRENT")},{" "}
        {getMaintenanceStatusLabel("DUE_SOON")},{" "}
        {getMaintenanceStatusLabel("DUE")},{" "}
        {getMaintenanceStatusLabel("OVERDUE")},{" "}
        {getMaintenanceStatusLabel("UNKNOWN")}.
      </p>
    </MatrixCard>
  );
}

function Mini({
  label,
  value,
  accent = "text-white",
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className={`mt-1 text-xl font-bold ${accent}`}>{value}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/50 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-2 text-sm text-slate-300">{value}</div>
    </div>
  );
}
