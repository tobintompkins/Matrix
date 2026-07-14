"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import AdminShell from "../../components/admin/AdminShell";
import { MatrixButton } from "../../components/ui";
import {
  hasMatrixPermission,
  resolveMatrixRole,
} from "@/lib/auth/permissions";
import {
  listAdminJobRuns,
  retryAdminJob,
  type AdminJobRun,
} from "@/lib/admin/completion/jobs";

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

export default function AdminJobsPage() {
  const { user } = useUser();
  const { role } = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );
  const canView = hasMatrixPermission(role, "VIEW_BACKGROUND_JOBS");
  const [jobs, setJobs] = useState<AdminJobRun[]>([]);
  const [failedOnly, setFailedOnly] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function refresh() {
    setJobs(listAdminJobRuns());
  }

  useEffect(() => {
    if (!canView) return;
    refresh();
  }, [canView]);

  const visible = failedOnly
    ? jobs.filter((j) => j.status === "Failed")
    : jobs;

  function onRetry(jobId: string) {
    setError("");
    setNotice("");
    const actor =
      user?.fullName ||
      user?.primaryEmailAddress?.emailAddress ||
      "Administrator";
    const result = retryAdminJob(jobId, actor);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNotice(`Retry recorded for job ${jobId}.`);
    refresh();
  }

  return (
    <AdminShell
      title="Background Jobs"
      subtitle="In-app admin job run history. Matrix does not host a dedicated external queue."
    >
      {!canView ? (
        <p className="text-sm text-rose-300" role="alert">
          You do not have permission to view background jobs.
        </p>
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

          <div className="mb-4 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={failedOnly}
                onChange={(e) => setFailedOnly(e.target.checked)}
                className="rounded border-slate-600"
              />
              Failed only
            </label>
            <MatrixButton
              type="button"
              size="sm"
              variant="secondary"
              onClick={refresh}
            >
              Refresh
            </MatrixButton>
          </div>

          {visible.length === 0 ? (
            <p className="text-sm text-slate-500">
              {failedOnly
                ? "No failed background jobs."
                : "No admin job runs recorded."}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-950/80 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Job Name</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Started</th>
                    <th className="px-3 py-2 font-medium">Duration</th>
                    <th className="px-3 py-2 font-medium">Attempts</th>
                    <th className="px-3 py-2 font-medium">Triggered By</th>
                    <th className="px-3 py-2 font-medium">Last Error</th>
                    <th className="px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {visible.map((job) => (
                    <tr key={job.id} className="bg-slate-950/40">
                      <td className="px-3 py-2 text-slate-100">{job.name}</td>
                      <td className="px-3 py-2 text-slate-300">{job.type}</td>
                      <td className="px-3 py-2 text-slate-200">{job.status}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-slate-400">
                        {job.startedAt.slice(0, 19).replace("T", " ")}
                      </td>
                      <td className="px-3 py-2 text-slate-300">
                        {formatDuration(job.durationMs)}
                      </td>
                      <td className="px-3 py-2 text-slate-300">{job.attempts}</td>
                      <td className="px-3 py-2 text-slate-300">{job.triggeredBy}</td>
                      <td className="max-w-xs px-3 py-2 text-slate-400">
                        {job.lastError ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        {job.status === "Failed" ? (
                          <MatrixButton
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => onRetry(job.id)}
                          >
                            Retry
                          </MatrixButton>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </AdminShell>
  );
}
