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

type Policy = { retentionClass: string; days: number };

export default function SystemLogRetentionPage() {
  const { user } = useUser();
  const { role } = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );
  const canView = hasMatrixPermission(role, "VIEW_SYSTEM_LOGS");
  const canManage = hasMatrixPermission(role, "MANAGE_LOG_RETENTION");
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/system-logs/retention", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setError(json.error ?? "Unable to load retention.");
      return;
    }
    setPolicies(json.policies ?? []);
    setNote(json.note ?? "");
  }, []);

  useEffect(() => {
    if (!canView) return;
    const t = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [canView, load]);

  if (!canView) {
    return (
      <AdminShell title="Log Retention">
        <p className="text-sm text-rose-300">Permission denied.</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title="Log Retention"
      subtitle="Retention classes for System Logs. Settings do not delete records immediately."
    >
      <Link href="/admin/system-logs">
        <MatrixButton variant="secondary">← Dashboard</MatrixButton>
      </Link>
      {note ? <p className="mt-3 text-sm text-amber-200/90">{note}</p> : null}
      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
      {message ? <p className="mt-3 text-sm text-emerald-300">{message}</p> : null}
      <MatrixCard title="Policies" className="mt-4">
        <ul className="space-y-3">
          {policies.map((p) => (
            <li
              key={p.retentionClass}
              className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-800 pb-3"
            >
              <div>
                <p className="font-medium text-slate-100">{p.retentionClass}</p>
                <p className="text-xs text-slate-500">Current: {p.days} days</p>
              </div>
              {canManage ? (
                <div className="flex items-end gap-2">
                  <label className="text-xs text-slate-400">
                    Days
                    <input
                      type="number"
                      className="mt-1 block w-28 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
                      defaultValue={p.days}
                      id={`ret-${p.retentionClass}`}
                    />
                  </label>
                  <MatrixButton
                    variant="secondary"
                    onClick={async () => {
                      const el = document.getElementById(
                        `ret-${p.retentionClass}`,
                      ) as HTMLInputElement | null;
                      const days = Number(el?.value ?? p.days);
                      if (
                        !window.confirm(
                          `Update ${p.retentionClass} retention to ${days} days? This does not delete logs immediately.`,
                        )
                      ) {
                        return;
                      }
                      setError("");
                      setMessage("");
                      const res = await fetch("/api/system-logs/retention", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          retentionClass: p.retentionClass,
                          days,
                          confirm: true,
                        }),
                      });
                      const json = await res.json();
                      if (!res.ok || !json.ok) {
                        setError(json.error ?? "Update failed.");
                      } else {
                        setMessage("Retention updated.");
                        await load();
                      }
                    }}
                  >
                    Save
                  </MatrixButton>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </MatrixCard>
    </AdminShell>
  );
}
