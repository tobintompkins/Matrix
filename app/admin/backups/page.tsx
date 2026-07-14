"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import AdminShell from "../../components/admin/AdminShell";
import { MatrixButton, MatrixCard } from "../../components/ui";
import {
  hasMatrixPermission,
  resolveMatrixRole,
} from "@/lib/auth/permissions";
import {
  getBackupStatus,
  requestManualBackup,
  type BackupStatusInfo,
} from "@/lib/admin/completion/backups";

export default function AdminBackupsPage() {
  const { user } = useUser();
  const { role } = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );
  const canView = hasMatrixPermission(role, "VIEW_BACKUP_STATUS");
  const [status, setStatus] = useState<BackupStatusInfo | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!canView) return;
    setStatus(getBackupStatus());
  }, [canView]);

  function onManualBackup() {
    setError("");
    setNotice("");
    const result = requestManualBackup();
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNotice("Manual backup requested.");
  }

  return (
    <AdminShell
      title="Backups"
      subtitle="Honest visibility into backup posture. Matrix does not invent hosted backup success."
    >
      {!canView ? (
        <p className="text-sm text-rose-300" role="alert">
          You do not have permission to view backup status.
        </p>
      ) : !status ? (
        <p className="text-sm text-slate-400">Loading backup status…</p>
      ) : (
        <>
          {error ? (
            <p className="mb-3 text-sm text-rose-300" role="alert">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p className="mb-3 text-sm text-emerald-300" role="status">
              {notice}
            </p>
          ) : null}

          <MatrixCard
            title="Backup status"
            subtitle={`Status: ${status.status}`}
            actions={
              <MatrixButton
                type="button"
                size="sm"
                variant="secondary"
                onClick={onManualBackup}
              >
                Request manual backup
              </MatrixButton>
            }
          >
            <p className="mb-4 text-sm text-slate-200">{status.summary}</p>
            <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              {status.documentation}
            </p>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">Provider</dt>
                <dd className="text-slate-200">{status.provider}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Enabled in Matrix</dt>
                <dd className="text-slate-200">{status.enabled ? "Yes" : "No"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Environment</dt>
                <dd className="text-slate-200">{status.environment}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Frequency</dt>
                <dd className="text-slate-200">{status.frequency}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Retention</dt>
                <dd className="text-slate-200">{status.retentionPolicy}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Verification</dt>
                <dd className="text-slate-200">{status.verificationStatus}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Last successful backup</dt>
                <dd className="text-slate-200">
                  {status.lastSuccessfulBackup ?? "Not verified by Matrix"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Last failed backup</dt>
                <dd className="text-slate-200">
                  {status.lastFailedBackup ?? "None recorded"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Next scheduled</dt>
                <dd className="text-slate-200">
                  {status.nextScheduledBackup ?? "Managed outside Matrix"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Manual / restore in Matrix</dt>
                <dd className="text-slate-200">
                  Manual: {status.manualBackupAvailable ? "Available" : "Not available"} ·
                  Restore: {status.restoreAvailable ? "Available" : "Not available"}
                </dd>
              </div>
            </dl>
          </MatrixCard>
        </>
      )}
    </AdminShell>
  );
}
