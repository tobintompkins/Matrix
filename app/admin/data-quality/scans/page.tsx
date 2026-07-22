"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import AdminShell from "../../../components/admin/AdminShell";
import { MatrixButton, MatrixCard } from "../../../components/ui";
import {
  hasMatrixPermission,
  resolveMatrixRole,
} from "@/lib/auth/permissions";

type Scan = {
  id: string;
  scanType: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  issuesFound: number | null;
  criticalIssuesFound: number | null;
};

export default function DataQualityScansPage() {
  const { user } = useUser();
  const { role } = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );
  const canView = hasMatrixPermission(role, "VIEW_DATA_QUALITY_CENTER");
  const canScan = hasMatrixPermission(role, "RUN_DATA_QUALITY_SCAN");
  const [items, setItems] = useState<Scan[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/data-quality/scans", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setError(json.error ?? "Unable to load scans.");
      return;
    }
    setItems(json.items ?? []);
  }, []);

  useEffect(() => {
    if (!canView) return;
    const t = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [canView, load]);

  async function runScan() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/data-quality/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanType: "MANUAL" }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Scan failed.");
      } else {
        setMessage(
          json.note ??
            `Scan complete. Created ${json.created}, updated ${json.updated}.`,
        );
        await fetch("/api/data-quality/snapshot", { method: "POST" });
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!canView) {
    return (
      <AdminShell title="Data Quality Scans">
        <p className="text-sm text-rose-300">Permission denied.</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title="Data Quality Scans"
      subtitle="Manual read-only scans. Source records are never modified by a scan."
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/admin/data-quality">
          <MatrixButton variant="secondary">← Dashboard</MatrixButton>
        </Link>
        {canScan ? (
          <MatrixButton disabled={busy} onClick={() => void runScan()}>
            {busy ? "Running…" : "Run Data Scan"}
          </MatrixButton>
        ) : null}
      </div>
      {error ? <p className="mb-3 text-sm text-rose-300">{error}</p> : null}
      {message ? <p className="mb-3 text-sm text-emerald-300">{message}</p> : null}
      <MatrixCard title="Scan History">
        <ul className="space-y-2 text-sm">
          {items.map((s) => (
            <li key={s.id} className="flex justify-between gap-2 border-b border-slate-800 py-2">
              <span>
                {s.scanType} · {s.status} · issues {s.issuesFound ?? 0} · critical{" "}
                {s.criticalIssuesFound ?? 0}
              </span>
              <span className="text-xs text-slate-500">
                {s.completedAt
                  ? new Date(s.completedAt).toLocaleString()
                  : s.startedAt
                    ? new Date(s.startedAt).toLocaleString()
                    : "—"}
              </span>
            </li>
          ))}
          {items.length === 0 ? (
            <li className="text-slate-400">No scans yet.</li>
          ) : null}
        </ul>
      </MatrixCard>
    </AdminShell>
  );
}
