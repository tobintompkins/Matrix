"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import AdminShell from "../../../components/admin/AdminShell";
import { MatrixCard, MatrixStatusBadge } from "../../../components/ui";
import {
  hasMatrixPermission,
  resolveMatrixRole,
} from "@/lib/auth/permissions";
import { approvalBadgeVariant } from "@/lib/approvals/badge";

type RuleRow = {
  id: string;
  name: string;
  description: string | null;
  approvalType: string;
  sourceModule: string | null;
  isActive: boolean;
  priority: number;
  conditionsJson: string;
  workflowJson: string;
};

export default function ApprovalRulesPage() {
  const { user } = useUser();
  const { role } = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );
  const canManage = hasMatrixPermission(role, "MANAGE_APPROVAL_RULES");
  const canView = hasMatrixPermission(role, "VIEW_APPROVAL_CENTER");
  const [items, setItems] = useState<RuleRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!canView) return;
    try {
      const res = await fetch("/api/approval-rules");
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Failed to load rules");
      setItems(json.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [canView]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(id: string, activate: boolean) {
    if (!canManage) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/approval-rules/${id}/${activate ? "activate" : "deactivate"}`,
        { method: "POST" },
      );
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Update failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  if (!canView) {
    return (
      <AdminShell title="Approval rules" subtitle="">
        <p className="text-sm text-rose-300" role="alert">
          You do not have permission to view approval rules.
        </p>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title="Approval rules"
      subtitle="Server-side rule evaluation builds workflows on submission. Seeded defaults are not overwritten."
    >
      <div className="mb-4">
        <Link href="/admin/approvals" className="text-sm text-sky-400 hover:underline">
          ← Approval Center
        </Link>
      </div>

      {error ? (
        <p className="mb-3 text-sm text-rose-300" role="alert">
          {error}
        </p>
      ) : null}

      <MatrixCard title="Configured rules">
        {items.length === 0 ? (
          <p className="text-sm text-slate-400">No rules found.</p>
        ) : (
          <ul className="space-y-4">
            {items.map((rule) => (
              <li
                key={rule.id}
                className="rounded-lg border border-slate-800 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-medium text-slate-100">{rule.name}</h3>
                    <p className="text-sm text-slate-400">
                      {rule.description ?? "No description"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Type: {rule.approvalType}
                      {rule.sourceModule ? ` · ${rule.sourceModule}` : ""} ·
                      Priority {rule.priority}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <MatrixStatusBadge
                      variant={approvalBadgeVariant(
                        rule.isActive ? "ACTIVE" : "INACTIVE",
                      )}
                      label={rule.isActive ? "ACTIVE" : "INACTIVE"}
                    />
                    {canManage ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void toggle(rule.id, !rule.isActive)}
                        className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-200 disabled:opacity-50"
                      >
                        {rule.isActive ? "Deactivate" : "Activate"}
                      </button>
                    ) : null}
                  </div>
                </div>
                <pre className="mt-3 overflow-x-auto rounded bg-slate-950 p-2 text-[11px] text-slate-400">
                  {JSON.stringify(
                    {
                      conditions: JSON.parse(rule.conditionsJson || "{}"),
                      workflow: JSON.parse(rule.workflowJson || "{}"),
                    },
                    null,
                    2,
                  )}
                </pre>
              </li>
            ))}
          </ul>
        )}
      </MatrixCard>
    </AdminShell>
  );
}
