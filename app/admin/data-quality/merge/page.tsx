"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import AdminShell from "../../../components/admin/AdminShell";
import { MatrixButton, MatrixCard } from "../../../components/ui";
import {
  hasMatrixPermission,
  resolveMatrixRole,
} from "@/lib/auth/permissions";

export default function DataQualityMergePage() {
  const searchParams = useSearchParams();
  const { user } = useUser();
  const { role } = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );
  const canMerge = hasMatrixPermission(role, "MERGE_DUPLICATE_RECORDS");
  const canHistory = hasMatrixPermission(role, "VIEW_DATA_QUALITY_HISTORY");
  const [entityType, setEntityType] = useState(
    searchParams.get("entityType") ?? "Customer",
  );
  const [masterRecordId, setMaster] = useState(
    searchParams.get("master") ?? "",
  );
  const [duplicateRecordId, setDup] = useState(
    searchParams.get("duplicate") ?? "",
  );
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<string>("");
  const [history, setHistory] = useState<
    Array<{
      id: string;
      entityType: string;
      masterRecordId: string;
      mergedRecordId: string;
      performedAt: string;
      reason: string;
    }>
  >([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const loadHistory = useCallback(async () => {
    if (!canHistory) return;
    const res = await fetch("/api/data-quality/merge/history", {
      cache: "no-store",
    });
    const json = await res.json();
    if (res.ok && json.ok) setHistory(json.items ?? []);
  }, [canHistory]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void loadHistory();
    }, 0);
    return () => window.clearTimeout(t);
  }, [loadHistory]);

  if (!canMerge) {
    return (
      <AdminShell title="Merge Wizard">
        <p className="text-sm text-rose-300">
          You do not have permission to merge duplicate records.
        </p>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title="Safe Record Merge Wizard"
      subtitle="Compare candidates, confirm master, archive the duplicate through existing services. Customer merges also open an Approval Center request."
    >
      <Link href="/admin/data-quality">
        <MatrixButton variant="secondary">← Dashboard</MatrixButton>
      </Link>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <MatrixCard title="1–8. Compare and Confirm">
          <div className="space-y-3 text-sm">
            <label className="block text-xs text-slate-400">
              Entity type
              <select
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1"
                value={entityType}
                onChange={(e) => setEntityType(e.target.value)}
              >
                {["Customer", "Machine", "Part"].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-slate-400">
              Master record id
              <input
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1"
                value={masterRecordId}
                onChange={(e) => setMaster(e.target.value)}
              />
            </label>
            <label className="block text-xs text-slate-400">
              Duplicate record id
              <input
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1"
                value={duplicateRecordId}
                onChange={(e) => setDup(e.target.value)}
              />
            </label>
            <label className="block text-xs text-slate-400">
              Merge reason
              <textarea
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            {error ? <p className="text-rose-300">{error}</p> : null}
            {message ? <p className="text-emerald-300">{message}</p> : null}
            <div className="flex flex-wrap gap-2">
              <MatrixButton
                variant="secondary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    const res = await fetch("/api/data-quality/merge/preview", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        entityType,
                        masterRecordId,
                        duplicateRecordId,
                      }),
                    });
                    const json = await res.json();
                    setPreview(JSON.stringify(json, null, 2));
                    if (!res.ok || !json.ok) {
                      setError(json.error ?? "Preview failed.");
                    }
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Compare Records
              </MatrixButton>
              <MatrixButton
                disabled={busy || reason.trim().length < 5}
                onClick={async () => {
                  if (
                    !window.confirm(
                      "Confirm merge? The duplicate will be archived. This cannot be silently undone.",
                    )
                  ) {
                    return;
                  }
                  setBusy(true);
                  setError("");
                  setMessage("");
                  try {
                    const res = await fetch("/api/data-quality/merge/execute", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        entityType,
                        masterRecordId,
                        duplicateRecordId,
                        reason,
                        confirm: true,
                      }),
                    });
                    const json = await res.json();
                    setPreview(JSON.stringify(json, null, 2));
                    if (!res.ok || !json.ok) {
                      setError(json.error ?? "Merge failed.");
                    } else {
                      setMessage(
                        `Merge completed${
                          json.approvalRequestId
                            ? ` (approval ${json.approvalRequestId})`
                            : ""
                        }.`,
                      );
                      await loadHistory();
                    }
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Merge Records
              </MatrixButton>
            </div>
            {preview ? (
              <pre className="max-h-80 overflow-auto rounded bg-slate-950 p-2 text-xs text-slate-300">
                {preview}
              </pre>
            ) : null}
          </div>
        </MatrixCard>

        <MatrixCard title="9–10. Completion / History">
          <ul className="space-y-2 text-sm">
            {history.map((h) => (
              <li key={h.id} className="border-b border-slate-800 py-2">
                <p>
                  {h.entityType}: {h.mergedRecordId} → {h.masterRecordId}
                </p>
                <p className="text-xs text-slate-500">
                  {new Date(h.performedAt).toLocaleString()} · {h.reason}
                </p>
              </li>
            ))}
            {history.length === 0 ? (
              <li className="text-slate-400">No merge history yet.</li>
            ) : null}
          </ul>
        </MatrixCard>
      </div>
    </AdminShell>
  );
}
