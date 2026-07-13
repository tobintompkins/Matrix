"use client";

import { useCallback, useState } from "react";
import {
  buildAllMaintenanceSnapshots,
  completeMaintenance,
  formatCopyCount,
  formatMaintenanceDate,
  getMaintenanceProfile,
  getMostUrgentMaintenanceStatus,
  getMaintenanceStatusLabel,
  listMaintenanceTimeline,
  recordCopyCount,
  saveInitialBaseline,
  type MaintenanceStatus,
  type PrinterMaintenanceProfile,
} from "@/lib/maintenance";
import { hasMatrixPermission } from "@/lib/auth/permissions";
import { DEV_FALLBACK_ROLE } from "@/lib/auth/types";
import {
  MatrixButton,
  MatrixCard,
  MatrixStatusBadge,
  type MatrixStatusVariant,
} from "@/app/components/ui";
import CopyCountEntryDialog from "./CopyCountEntryDialog";
import CompleteMaintenanceDialog from "./CompleteMaintenanceDialog";
import InitialBaselineDialog from "./InitialBaselineDialog";
import MaintenanceTimeline from "./MaintenanceTimeline";
import PrinterIntelligencePanel from "./PrinterIntelligencePanel";
import {
  notifyCopyCountUpdated,
  notifyMaintenanceCompleted,
} from "@/lib/notifications";

type Props = {
  printerId: string;
  title?: string;
};

function statusVariant(status: MaintenanceStatus): MatrixStatusVariant {
  switch (status) {
    case "CURRENT":
      return "completed";
    case "DUE_SOON":
      return "warning";
    case "DUE":
    case "OVERDUE":
      return "error";
    case "UNKNOWN":
    default:
      return "offline";
  }
}

function StatusIcon({ status }: { status: MaintenanceStatus }) {
  const label =
    status === "OVERDUE"
      ? "!"
      : status === "DUE"
        ? "●"
        : status === "DUE_SOON"
          ? "▲"
          : status === "CURRENT"
            ? "✓"
            : "?";
  return (
    <span className="mr-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-current text-[10px] font-bold" aria-hidden>
      {label}
    </span>
  );
}

export default function MachineMaintenancePanel({
  printerId,
  title = "Machine Maintenance",
}: Props) {
  const [profile, setProfile] = useState<PrinterMaintenanceProfile | null>(
    () => getMaintenanceProfile(printerId) ?? null,
  );
  const [timeline, setTimeline] = useState(() =>
    listMaintenanceTimeline(printerId),
  );
  const [copyOpen, setCopyOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const canEnter = hasMatrixPermission(DEV_FALLBACK_ROLE, "ENTER_COPY_COUNT");
  const canComplete = hasMatrixPermission(
    DEV_FALLBACK_ROLE,
    "COMPLETE_MAINTENANCE",
  );
  const canBaseline = hasMatrixPermission(
    DEV_FALLBACK_ROLE,
    "EDIT_MAINTENANCE_BASELINE",
  );

  const refresh = useCallback(() => {
    setProfile(getMaintenanceProfile(printerId) ?? null);
    setTimeline(listMaintenanceTimeline(printerId));
  }, [printerId]);

  if (!profile) {
    return (
      <MatrixCard title={title}>
        <p className="text-sm text-slate-400">
          No maintenance profile for this printer yet.
        </p>
      </MatrixCard>
    );
  }

  const snapshots = buildAllMaintenanceSnapshots(profile);
  const overall = getMostUrgentMaintenanceStatus(profile);

  return (
    <div className="space-y-4">
      {notice && (
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 px-4 py-3 text-sm text-cyan-200">
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      <MatrixCard
        title={title}
        subtitle={`${profile.nickname} · ${profile.assetTag} · ${profile.printerModel}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <MatrixStatusBadge
              variant={statusVariant(overall)}
              label={getMaintenanceStatusLabel(overall)}
            />
            {canEnter && (
              <MatrixButton
                type="button"
                variant="primary"
                size="md"
                onClick={() => setCopyOpen(true)}
              >
                Enter Copy Count
              </MatrixButton>
            )}
            {canComplete && (
              <MatrixButton
                type="button"
                variant="secondary"
                size="md"
                onClick={() => setCompleteOpen(true)}
              >
                Complete Maintenance
              </MatrixButton>
            )}
            {canBaseline && (
              <MatrixButton
                type="button"
                variant="secondary"
                size="md"
                onClick={() => setSetupOpen(true)}
              >
                Initial Setup
              </MatrixButton>
            )}
          </div>
        }
      >
        <p className="mb-4 text-sm text-slate-400">
          Current copy count:{" "}
          <span className="font-semibold text-white">
            {formatCopyCount(profile.currentCopyCount)}
          </span>
        </p>

        <div className="grid gap-4 lg:grid-cols-2">
          {snapshots.map((snap) => (
            <div
              key={snap.kind}
              className="rounded-xl border border-slate-800 bg-slate-950/50 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-semibold text-white">{snap.label}</h4>
                <span
                  className="inline-flex items-center text-xs font-semibold"
                  title={snap.statusDisplay}
                >
                  <StatusIcon status={snap.status} />
                  <MatrixStatusBadge
                    variant={statusVariant(snap.status)}
                    label={snap.statusDisplay}
                  />
                </span>
              </div>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500">Current count</dt>
                  <dd className="text-white">
                    {formatCopyCount(profile.currentCopyCount)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Last completed count</dt>
                  <dd className="text-white">
                    {formatCopyCount(snap.lastCompletedCopyCount)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Next due count</dt>
                  <dd className="text-white">
                    {formatCopyCount(snap.nextDueCount)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Copies remaining</dt>
                  <dd className="text-white">
                    {formatCopyCount(snap.copiesRemaining)}
                  </dd>
                </div>
                {snap.copiesOverdue !== null && snap.copiesOverdue > 0 && (
                  <div>
                    <dt className="text-slate-500">Copies overdue</dt>
                    <dd className="font-semibold text-rose-300">
                      {formatCopyCount(snap.copiesOverdue)}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-slate-500">Last completed date</dt>
                  <dd className="text-white">
                    {formatMaintenanceDate(snap.lastCompletedDate)}
                  </dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      </MatrixCard>

      <PrinterIntelligencePanel printerId={profile.printerId} />

      <MaintenanceTimeline events={timeline} />

      <CopyCountEntryDialog
        open={copyOpen}
        currentCopyCount={profile.currentCopyCount}
        previousCopyCount={profile.currentCopyCount}
        onClose={() => setCopyOpen(false)}
        onSave={({ copyCount, notes, lowerCountReason }) => {
          const result = recordCopyCount({
            printerId: profile.printerId,
            copyCount,
            notes,
            enteredBy: "Matrix User",
            lowerCountReason,
          });
          if (!result.ok) {
            setNotice("");
            setError(result.error);
            return;
          }
          setError("");
          setNotice(
            `Copy count saved: ${formatCopyCount(result.history.copyCount)}. Maintenance statuses recalculated.`,
          );
          notifyCopyCountUpdated({
            printerId: profile.printerId,
            printerName: profile.nickname || profile.assetTag,
            customerName: profile.customerName,
            copyCount,
            enteredBy: "Matrix User",
          });
          setCopyOpen(false);
          refresh();
        }}
      />

      <CompleteMaintenanceDialog
        open={completeOpen}
        printerName={`${profile.nickname} (${profile.assetTag})`}
        defaultCopyCount={profile.currentCopyCount}
        onClose={() => setCompleteOpen(false)}
        onSave={(input) => {
          const result = completeMaintenance({
            printerId: profile.printerId,
            ...input,
          });
          if (!result.ok) {
            setNotice("");
            setError(result.error);
            return;
          }
          setError("");
          setNotice(`${input.kind} completion saved. Next due count updated.`);
          notifyMaintenanceCompleted({
            printerId: profile.printerId,
            printerName: profile.nickname || profile.assetTag,
            customerName: profile.customerName,
            kind: input.kind,
            technician: input.technician,
          });
          setCompleteOpen(false);
          refresh();
        }}
      />

      <InitialBaselineDialog
        open={setupOpen}
        printerName={`${profile.nickname} (${profile.assetTag})`}
        onClose={() => setSetupOpen(false)}
        onSave={(input) => {
          const result = saveInitialBaseline({
            printerId: profile.printerId,
            ...input,
            enteredBy: "Matrix User",
          });
          if (!result.ok) {
            setNotice("");
            setError(result.error);
            return;
          }
          setError("");
          setNotice("Maintenance baseline saved. Due counts recalculated.");
          setSetupOpen(false);
          refresh();
        }}
      />
    </div>
  );
}
