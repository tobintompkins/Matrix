"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import AdminShell from "../../components/admin/AdminShell";
import {
  COMPLETED_PM_WARNING,
  prepareReopenCompletedPm,
  softDeletePmHistory,
  restorePmHistory,
  archivePmSchedule,
} from "@/lib/admin/data/pm";
import { DEFAULT_DELETION_REASONS } from "@/lib/admin/data/deletion-reasons";
import { hasMatrixPermission, resolveMatrixRole } from "@/lib/auth/permissions";
import { MatrixButton } from "../../components/ui";

export default function AdminPmPage() {
  const { user } = useUser();
  const { role } = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );
  const actor = {
    userId: user?.id ?? "dev-user",
    displayName: user?.fullName ?? "Matrix User",
    canReopenCompleted: hasMatrixPermission(role, "REOPEN_COMPLETED_PM"),
  };

  const [historyId, setHistoryId] = useState("");
  const [machineId, setMachineId] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  return (
    <AdminShell
      title="Preventive Maintenance"
      subtitle="Administer PM schedules and history using the existing PM system. Soft delete only invalid or test records."
    >
      <p className="mb-4 text-sm text-slate-400">
        This page does not replace Preventive Maintenance workflows. Use it for
        administrative corrections, archive, soft delete, restore, and reopen
        preparation. Interval and completion changes continue through existing
        PM APIs.
      </p>

      {message ? (
        <p className="mb-3 text-sm text-emerald-300" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mb-3 text-sm text-rose-300" role="alert">
          {error}
        </p>
      ) : null}

      <section className="space-y-4 rounded-xl border border-slate-800 p-4">
        <h2 className="text-base font-semibold text-white">
          Completed PM protection
        </h2>
        <p className="text-sm text-amber-200" role="alert">
          {COMPLETED_PM_WARNING}
        </p>
        <label className="block text-sm text-slate-400">
          PM History ID
          <input
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            value={historyId}
            onChange={(e) => setHistoryId(e.target.value)}
          />
        </label>
        <label className="block text-sm text-slate-400">
          Reason
          <input
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <MatrixButton
            type="button"
            onClick={() => {
              const result = prepareReopenCompletedPm(
                historyId.trim(),
                actor,
                reason,
              );
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setMessage(
                `${result.auditEvent} prepared for ${result.historyId}. Complete reopen through existing PM workflow with reason recorded.`,
              );
              setError("");
            }}
          >
            Prepare reopen
          </MatrixButton>
          {hasMatrixPermission(role, "DELETE_PM") ? (
            <MatrixButton
              type="button"
              variant="secondary"
              onClick={() => {
                const result = softDeletePmHistory(historyId.trim(), actor, {
                  reason: DEFAULT_DELETION_REASONS[0].key,
                  notes: reason,
                  machineId: machineId || undefined,
                });
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                setMessage("PM history soft deleted.");
              }}
            >
              Soft delete history
            </MatrixButton>
          ) : null}
          {hasMatrixPermission(role, "RESTORE_PM") ? (
            <MatrixButton
              type="button"
              variant="secondary"
              onClick={() => {
                const result = restorePmHistory(
                  historyId.trim(),
                  actor,
                  reason,
                );
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                setMessage("PM history restored.");
              }}
            >
              Restore history
            </MatrixButton>
          ) : null}
        </div>
      </section>

      <section className="mt-6 space-y-4 rounded-xl border border-slate-800 p-4">
        <h2 className="text-base font-semibold text-white">
          PM schedule archive
        </h2>
        <label className="block text-sm text-slate-400">
          Machine ID
          <input
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            value={machineId}
            onChange={(e) => setMachineId(e.target.value)}
          />
        </label>
        <MatrixButton
          type="button"
          variant="secondary"
          onClick={() => {
            const result = archivePmSchedule(
              machineId.trim(),
              actor,
              reason || "Duplicate or inactive schedule",
            );
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setMessage("PM schedule archived.");
          }}
        >
          Archive schedule
        </MatrixButton>
      </section>
    </AdminShell>
  );
}
