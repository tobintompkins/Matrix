"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import AdminShell from "../../../../components/admin/AdminShell";
import { MatrixButton, MatrixCard } from "../../../../components/ui";
import {
  hasMatrixPermission,
  resolveMatrixRole,
} from "@/lib/auth/permissions";

type Issue = {
  id: string;
  title: string;
  severity: string;
  status: string;
  module: string;
  entityType: string;
  entityId: string;
  secondaryEntityId: string | null;
  issueType: string;
  fieldName: string | null;
  currentValue: string | null;
  expectedValue: string | null;
  description: string;
  evidence: string | null;
  confidenceScore: number | null;
  ruleId: string | null;
  scanId: string | null;
  assignedToUserId: string | null;
  firstDetectedAt: string;
  lastDetectedAt: string;
  dueAt: string | null;
  resolutionMethod: string | null;
  resolutionNote: string | null;
};

export default function DataQualityIssueDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useUser();
  const { role } = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );
  const canView = hasMatrixPermission(role, "VIEW_DATA_QUALITY_ISSUES");
  const canAssign = hasMatrixPermission(role, "ASSIGN_DATA_QUALITY_ISSUE");
  const canResolve = hasMatrixPermission(role, "RESOLVE_DATA_QUALITY_ISSUE");
  const canDismiss = hasMatrixPermission(role, "DISMISS_DATA_QUALITY_ISSUE");
  const canReopen = hasMatrixPermission(role, "REOPEN_DATA_QUALITY_ISSUE");
  const canFix = hasMatrixPermission(role, "FIX_DATA_QUALITY_RECORD");
  const canMerge = hasMatrixPermission(role, "MERGE_DUPLICATE_RECORDS");
  const [issue, setIssue] = useState<Issue | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [assignee, setAssignee] = useState("");
  const [fixPreview, setFixPreview] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch(`/api/data-quality/issues/${params.id}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Unable to load issue.");
        setIssue(null);
        return;
      }
      setIssue(json.issue);
    } catch {
      setError("Unable to load issue.");
    }
  }, [params.id]);

  useEffect(() => {
    if (!canView) return;
    const t = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [canView, load]);

  async function postAction(path: string, body?: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Action failed.");
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!canView) {
    return (
      <AdminShell title="Issue Detail">
        <p className="text-sm text-rose-300">Permission denied.</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell title="Review Issue" subtitle={issue?.title ?? "Loading…"}>
      <div className="mb-4">
        <Link href="/admin/data-quality/issues">
          <MatrixButton variant="secondary">← Issue Queue</MatrixButton>
        </Link>
      </div>
      {error ? <p className="mb-3 text-sm text-rose-300">{error}</p> : null}
      {!issue ? (
        <p className="text-sm text-slate-400">Loading issue…</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <MatrixCard title="Issue">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-400">Severity</dt>
                <dd>{issue.severity}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-400">Status</dt>
                <dd>{issue.status}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-400">Module</dt>
                <dd>{issue.module}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-400">Type</dt>
                <dd>{issue.issueType}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-400">Record</dt>
                <dd>
                  {issue.entityType}:{issue.entityId}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-400">Field</dt>
                <dd>{issue.fieldName ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-400">Current</dt>
                <dd className="max-w-[60%] truncate">{issue.currentValue ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-400">Expected</dt>
                <dd>{issue.expectedValue ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Description</dt>
                <dd className="mt-1 text-slate-200">{issue.description}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-400">First / Last detected</dt>
                <dd className="text-right text-xs">
                  {new Date(issue.firstDetectedAt).toLocaleString()}
                  <br />
                  {new Date(issue.lastDetectedAt).toLocaleString()}
                </dd>
              </div>
              {issue.evidence ? (
                <div>
                  <dt className="text-slate-400">Evidence</dt>
                  <dd className="mt-1 whitespace-pre-wrap text-xs text-slate-300">
                    {issue.evidence}
                  </dd>
                </div>
              ) : null}
            </dl>
          </MatrixCard>

          <MatrixCard title="Actions">
            <div className="mb-3 space-y-2">
              <label className="block text-xs text-slate-400">
                Note / reason
                <textarea
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
              {canAssign ? (
                <label className="block text-xs text-slate-400">
                  Assign to user id
                  <input
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
                    value={assignee}
                    onChange={(e) => setAssignee(e.target.value)}
                  />
                </label>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {canAssign ? (
                <>
                  <MatrixButton
                    disabled={busy || !assignee}
                    onClick={() =>
                      void postAction(
                        `/api/data-quality/issues/${issue.id}/assign`,
                        { assignedToUserId: assignee, note },
                      )
                    }
                  >
                    Assign Issue
                  </MatrixButton>
                  <MatrixButton
                    variant="secondary"
                    disabled={busy}
                    onClick={() =>
                      void postAction(
                        `/api/data-quality/issues/${issue.id}/start-review`,
                      )
                    }
                  >
                    Start Review
                  </MatrixButton>
                </>
              ) : null}
              {canResolve ? (
                <MatrixButton
                  disabled={busy || !note.trim()}
                  onClick={() =>
                    void postAction(
                      `/api/data-quality/issues/${issue.id}/resolve`,
                      {
                        resolutionMethod: "MANUAL_FIX",
                        resolutionNote: note,
                      },
                    )
                  }
                >
                  Resolve Issue
                </MatrixButton>
              ) : null}
              {canDismiss ? (
                <>
                  <MatrixButton
                    variant="secondary"
                    disabled={busy || !note.trim()}
                    onClick={() =>
                      void postAction(
                        `/api/data-quality/issues/${issue.id}/dismiss`,
                        { reason: note },
                      )
                    }
                  >
                    Dismiss Issue
                  </MatrixButton>
                  <MatrixButton
                    variant="secondary"
                    disabled={busy || !note.trim()}
                    onClick={() =>
                      void postAction(
                        `/api/data-quality/issues/${issue.id}/false-positive`,
                        { reason: note },
                      )
                    }
                  >
                    Mark False Positive
                  </MatrixButton>
                </>
              ) : null}
              {canReopen ? (
                <MatrixButton
                  variant="secondary"
                  disabled={busy}
                  onClick={() =>
                    void postAction(
                      `/api/data-quality/issues/${issue.id}/reopen`,
                      { note: note || "Reopened" },
                    )
                  }
                >
                  Reopen
                </MatrixButton>
              ) : null}
              {canFix && issue.issueType === "MISSING_REQUIRED_VALUE" ? (
                <>
                  <MatrixButton
                    variant="secondary"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        const res = await fetch("/api/data-quality/fixes/preview", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            issueId: issue.id,
                            fixCode: "TRIM_WHITESPACE_CUSTOMER_NAME",
                          }),
                        });
                        const json = await res.json();
                        setFixPreview(JSON.stringify(json, null, 2));
                        if (!res.ok || !json.ok) {
                          setError(json.error ?? "Preview failed.");
                        }
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Preview Fix
                  </MatrixButton>
                  <MatrixButton
                    disabled={busy}
                    onClick={() =>
                      void postAction("/api/data-quality/fixes/execute", {
                        issueId: issue.id,
                        fixCode: "TRIM_WHITESPACE_CUSTOMER_NAME",
                        confirm: true,
                      })
                    }
                  >
                    Apply Fix
                  </MatrixButton>
                </>
              ) : null}
              {canMerge &&
              (issue.issueType === "DUPLICATE" ||
                issue.issueType === "POSSIBLE_MERGE") &&
              issue.secondaryEntityId ? (
                <Link
                  href={`/admin/data-quality/merge?entityType=${issue.entityType}&master=${issue.entityId}&duplicate=${issue.secondaryEntityId}`}
                >
                  <MatrixButton variant="secondary">Open Merge Wizard</MatrixButton>
                </Link>
              ) : null}
            </div>
            {fixPreview ? (
              <pre className="mt-3 overflow-auto rounded bg-slate-950 p-2 text-xs text-slate-300">
                {fixPreview}
              </pre>
            ) : null}
          </MatrixCard>
        </div>
      )}
    </AdminShell>
  );
}
