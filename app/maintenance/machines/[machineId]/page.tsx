"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import MatrixShell from "../../../components/MatrixShell";
import MatrixAuthGuard from "../../../components/MatrixAuthGuard";
import {
  MatrixButton,
  MatrixCard,
  MatrixPageHeader,
} from "../../../components/ui";
import MaintenanceSubnav from "../../components/MaintenanceSubnav";
import PmCleaningStatusBadge from "../../components/PmCleaningStatusBadge";
import CompletePmWorkflowForm from "../../components/CompletePmWorkflowForm";
import {
  fetchPmAudit,
  fetchPmMachine,
  newIdempotencyKey,
  postPmInterval,
  postPmMeter,
} from "@/lib/maintenance/pm-api-client";
import type { PmDashboardRow } from "@/lib/maintenance/pm-prisma-repository";
import { hasMatrixPermission } from "@/lib/auth/permissions";
import { DEV_FALLBACK_ROLE } from "@/lib/auth/types";
import PredictiveMachineChip from "../../../components/predictive/PredictiveMachineChip";

type MachineDetail = PmDashboardRow & {
  history: Array<{
    id: string;
    completedAt: string;
    countAtCompletion: number;
    previousPmCount: number | null;
    pmIntervalAtCompletion: number;
    technician: string;
    recordedBy: string | null;
    notes: string | null;
    laborMinutes?: number | null;
    qualityScore?: number | null;
    checklistCompletionPct?: number | null;
    statusAtCompletion?: string | null;
    partsUsedJson?: string | null;
  }>;
  recentMeters: Array<{
    id: string;
    meterCount: number;
    previousCount: number | null;
    enteredBy: string | null;
    recordedAt: string;
    notes: string | null;
  }>;
  modelDefaultInterval: number | null;
};

export default function MachinePmDetailPage() {
  const params = useParams();
  const machineId = String(params.machineId ?? "");
  const canComplete = hasMatrixPermission(
    DEV_FALLBACK_ROLE,
    "COMPLETE_MAINTENANCE",
  );
  const canEditInterval = hasMatrixPermission(
    DEV_FALLBACK_ROLE,
    "EDIT_MAINTENANCE_INTERVALS",
  );
  const canEnterCount = hasMatrixPermission(
    DEV_FALLBACK_ROLE,
    "ENTER_COPY_COUNT",
  );

  const [machine, setMachine] = useState<MachineDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [tech, setTech] = useState("Alex Rivera");
  const [intervalInput, setIntervalInput] = useState("");
  const [meterInput, setMeterInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [auditRows, setAuditRows] = useState<
    Array<{
      id: string;
      action: string;
      user: string | null;
      previousValue: string | null;
      newValue: string | null;
      createdAt: string;
    }>
  >([]);

  const load = useCallback(async () => {
    if (!machineId) return;
    setLoading(true);
    setError("");
    try {
      const data = await fetchPmMachine(machineId);
      if (!data.ok || !data.machine) {
        setError(data.error ?? "Machine not found");
        setMachine(null);
        return;
      }
      setMachine(data.machine as MachineDetail);
      setMeterInput(
        data.machine.currentMeterCount != null
          ? String(data.machine.currentMeterCount)
          : "",
      );
      setIntervalInput(
        data.machine.pmInterval != null
          ? String(data.machine.pmInterval)
          : data.machine.modelDefaultInterval != null
            ? String(data.machine.modelDefaultInterval)
            : "",
      );
      if (data.machine.assignedTechnician) {
        setTech(data.machine.assignedTechnician);
      }
      const audit = await fetchPmAudit(machineId);
      if (audit.ok) setAuditRows(audit.rows ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [machineId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSaveInterval(e: React.FormEvent) {
    e.preventDefault();
    if (!canEditInterval || !machine || busy) return;
    const trimmed = intervalInput.trim();
    const interval = trimmed === "" ? null : Number(trimmed);
    if (interval !== null && (!Number.isInteger(interval) || interval <= 0)) {
      setError("Interval must be a positive whole number.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await postPmInterval({
        machineId: machine.machineId,
        interval,
        actor: tech.trim() || "Service Manager",
      });
      if (!result.ok) {
        setError(result.error ?? "Failed to save interval");
        return;
      }
      setNotice(
        interval == null
          ? "PM interval cleared (Not Configured)."
          : `PM interval saved: ${interval.toLocaleString()}`,
      );
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function onSaveMeter(e: React.FormEvent) {
    e.preventDefault();
    if (!canEnterCount || !machine || busy) return;
    const meterCount = Number(meterInput);
    if (!Number.isInteger(meterCount) || meterCount < 0) {
      setError("Meter count must be a nonnegative whole number.");
      return;
    }
    let lowerCountReason: string | undefined;
    if (
      machine.currentMeterCount != null &&
      meterCount < machine.currentMeterCount
    ) {
      lowerCountReason =
        window.prompt("Count is lower than latest reading. Reason required:") ||
        "";
      if (!lowerCountReason.trim()) {
        setError("Lower-count reason is required.");
        return;
      }
    }
    setBusy(true);
    setError("");
    try {
      const result = await postPmMeter({
        machineId: machine.machineId,
        meterCount,
        enteredBy: tech.trim() || "Technician",
        lowerCountReason,
        idempotencyKey: newIdempotencyKey("pm-meter"),
      });
      if (!result.ok) {
        setError(result.error ?? "Failed to save meter");
        return;
      }
      setNotice(
        "Meter reading saved. PM status recalculated (PM not auto-completed).",
      );
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <MatrixShell title="Machine PM" activePath="/maintenance">
      <MatrixAuthGuard requiredPermissions={["VIEW_FLEET_MAINTENANCE"]}>
        <MatrixPageHeader
          title={machine?.nickname ?? machineId}
          subtitle="Per-machine PM summary, checklist workflow, history, and audit."
          breadcrumbs={[
            "Matrix",
            "Preventive Maintenance",
            "Machine",
            machineId,
          ]}
          actions={
            <MatrixButton href="/maintenance" variant="secondary" size="md">
              Back to Preventive Maintenance
            </MatrixButton>
          }
        />
        <MaintenanceSubnav />

        {error ? (
          <p
            className="mb-4 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="mb-4 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
            {notice}
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : !machine ? (
          <p className="text-sm text-slate-400">Machine not found.</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <MatrixCard
              title="Machine PM Summary"
              subtitle="Health status and cleaning-count schedule"
            >
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-slate-500">PM Health Status</dt>
                  <dd className="mt-1">
                    <PmCleaningStatusBadge status={machine.status} />
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Customer</dt>
                  <dd className="mt-1 text-slate-200">
                    {machine.customerName ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Current meter</dt>
                  <dd className="mt-1 tabular-nums text-slate-200">
                    {machine.currentMeterCount?.toLocaleString() ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Last PM</dt>
                  <dd className="mt-1 text-slate-200">
                    {machine.lastPmAt
                      ? new Date(machine.lastPmAt).toLocaleString()
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Next PM due</dt>
                  <dd className="mt-1 tabular-nums text-slate-200">
                    {machine.nextPmDueCount?.toLocaleString() ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">PM interval</dt>
                  <dd className="mt-1 tabular-nums text-slate-200">
                    {machine.pmInterval?.toLocaleString() ?? "Not configured"}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Counts remaining</dt>
                  <dd className="mt-1 tabular-nums text-slate-200">
                    {machine.countsRemaining?.toLocaleString() ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Last technician</dt>
                  <dd className="mt-1 text-slate-200">
                    {machine.lastPmTechnician ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Last labor time</dt>
                  <dd className="mt-1 tabular-nums text-slate-200">
                    {machine.lastLaborMinutes != null
                      ? `${machine.lastLaborMinutes} min`
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Last PM count</dt>
                  <dd className="mt-1 tabular-nums text-slate-200">
                    {machine.lastPmCount?.toLocaleString() ?? "—"}
                  </dd>
                </div>
              </dl>
              <p className="mt-4 text-xs text-slate-500">
                Model default interval:{" "}
                {machine.modelDefaultInterval?.toLocaleString() ?? "—"}
              </p>
              <div className="mt-3">
                <PredictiveMachineChip machineId={machine.machineId} />
              </div>
              <Link
                href={`/digital-twin/${encodeURIComponent(machine.machineId)}`}
                className="mt-3 inline-block text-sm text-cyan-400 hover:underline"
              >
                Open Digital Twin
              </Link>
            </MatrixCard>

            <div className="space-y-6">
              {canEditInterval ? (
                <MatrixCard title="Configure PM Interval">
                  <form className="space-y-3" onSubmit={onSaveInterval}>
                    <label className="block text-sm text-slate-400">
                      Interval (impressions)
                      <input
                        className="mt-1 min-h-12 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-slate-100"
                        value={intervalInput}
                        onChange={(e) => setIntervalInput(e.target.value)}
                        inputMode="numeric"
                      />
                    </label>
                    <MatrixButton
                      type="submit"
                      variant="secondary"
                      className="min-h-12"
                      disabled={busy}
                    >
                      Save interval
                    </MatrixButton>
                  </form>
                </MatrixCard>
              ) : null}

              {canEnterCount ? (
                <MatrixCard
                  title="Enter Meter Count"
                  subtitle="Updates latest meter and PM status — does not complete a PM."
                >
                  <form className="space-y-3" onSubmit={onSaveMeter}>
                    <label className="block text-sm text-slate-400">
                      Meter count
                      <input
                        className="mt-1 min-h-12 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-slate-100"
                        value={meterInput}
                        onChange={(e) => setMeterInput(e.target.value)}
                        inputMode="numeric"
                        required
                      />
                    </label>
                    <MatrixButton
                      type="submit"
                      variant="secondary"
                      className="min-h-12"
                      disabled={busy}
                    >
                      Save meter
                    </MatrixButton>
                  </form>
                </MatrixCard>
              ) : null}
            </div>

            {canComplete ? (
              <MatrixCard
                title="Complete PM Workflow"
                className="lg:col-span-2"
                subtitle="Checklist, labor, parts, notes — save progress and resume anytime."
              >
                {machine.pmInterval == null ? (
                  <p className="text-sm text-amber-300">
                    Configure the PM interval before completing a PM.
                  </p>
                ) : (
                  <CompletePmWorkflowForm
                    machineId={machine.machineId}
                    printerModel={machine.printerModel}
                    defaultMeter={machine.currentMeterCount}
                    defaultTechnician={tech}
                    disabled={busy}
                    onError={setError}
                    onCompleted={(msg) => {
                      setNotice(msg);
                      setError("");
                      void load();
                    }}
                  />
                )}
              </MatrixCard>
            ) : null}

            <MatrixCard
              title="Recent PM History"
              className="lg:col-span-2"
              subtitle="Includes labor, quality score, checklist %, and parts."
            >
              {machine.history.length === 0 ? (
                <p className="text-sm text-slate-500">No PM history yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-slate-800 text-xs uppercase text-slate-400">
                      <tr>
                        <th className="px-3 py-2">Completed</th>
                        <th className="px-3 py-2">Technician</th>
                        <th className="px-3 py-2">Labor</th>
                        <th className="px-3 py-2">Meter</th>
                        <th className="px-3 py-2">Checklist</th>
                        <th className="px-3 py-2">Quality</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Parts</th>
                        <th className="px-3 py-2">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {machine.history.map((h) => {
                        let partsLabel = "—";
                        if (h.partsUsedJson) {
                          try {
                            const parts = JSON.parse(h.partsUsedJson) as Array<{
                              partNumber: string;
                              quantity: number;
                            }>;
                            partsLabel =
                              parts.length === 0
                                ? "None"
                                : parts
                                    .map((p) => `${p.partNumber}×${p.quantity}`)
                                    .join(", ");
                          } catch {
                            partsLabel = "—";
                          }
                        }
                        return (
                          <tr
                            key={h.id}
                            className="border-t border-slate-800/80"
                          >
                            <td className="px-3 py-2">
                              {new Date(h.completedAt).toLocaleString()}
                            </td>
                            <td className="px-3 py-2">{h.technician}</td>
                            <td className="px-3 py-2 tabular-nums">
                              {h.laborMinutes != null
                                ? `${h.laborMinutes}m`
                                : "—"}
                            </td>
                            <td className="px-3 py-2 tabular-nums">
                              {h.countAtCompletion.toLocaleString()}
                            </td>
                            <td className="px-3 py-2 tabular-nums">
                              {h.checklistCompletionPct != null
                                ? `${h.checklistCompletionPct}%`
                                : "—"}
                            </td>
                            <td className="px-3 py-2 tabular-nums">
                              {h.qualityScore != null
                                ? `${h.qualityScore}%`
                                : "—"}
                            </td>
                            <td className="px-3 py-2">
                              {h.statusAtCompletion ?? "—"}
                            </td>
                            <td className="px-3 py-2 text-slate-400">
                              {partsLabel}
                            </td>
                            <td className="px-3 py-2 text-slate-400">
                              {h.notes ?? "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </MatrixCard>

            <MatrixCard
              title="PM Audit Log"
              className="lg:col-span-2"
              subtitle="Every PM action is retained. History is never deleted."
            >
              {auditRows.length === 0 ? (
                <p className="text-sm text-slate-500">No audit entries yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-slate-800 text-xs uppercase text-slate-400">
                      <tr>
                        <th className="px-3 py-2">Date / Time</th>
                        <th className="px-3 py-2">User</th>
                        <th className="px-3 py-2">Action</th>
                        <th className="px-3 py-2">Previous</th>
                        <th className="px-3 py-2">New</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditRows.map((a) => (
                        <tr key={a.id} className="border-t border-slate-800/80">
                          <td className="px-3 py-2 whitespace-nowrap">
                            {new Date(a.createdAt).toLocaleString()}
                          </td>
                          <td className="px-3 py-2">{a.user ?? "—"}</td>
                          <td className="px-3 py-2">{a.action}</td>
                          <td className="max-w-[12rem] truncate px-3 py-2 text-slate-500">
                            {a.previousValue ?? "—"}
                          </td>
                          <td className="max-w-[12rem] truncate px-3 py-2 text-slate-400">
                            {a.newValue ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </MatrixCard>
          </div>
        )}
      </MatrixAuthGuard>
    </MatrixShell>
  );
}
