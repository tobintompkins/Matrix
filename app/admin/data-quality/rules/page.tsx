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

type Rule = {
  id: string;
  code: string;
  name: string;
  description: string;
  module: string;
  severity: string;
  isActive: boolean;
  isSystemRule: boolean;
};

export default function DataQualityRulesPage() {
  const { user } = useUser();
  const { role } = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );
  const canView = hasMatrixPermission(role, "VIEW_DATA_QUALITY_CENTER");
  const canEnable = hasMatrixPermission(role, "ENABLE_DATA_QUALITY_RULE");
  const canDisable = hasMatrixPermission(role, "DISABLE_DATA_QUALITY_RULE");
  const [items, setItems] = useState<Rule[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/data-quality/rules", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setError(json.error ?? "Unable to load rules.");
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

  if (!canView) {
    return (
      <AdminShell title="Data Quality Rules">
        <p className="text-sm text-rose-300">Permission denied.</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title="Data Quality Rules"
      subtitle="Declarative system and custom rules. Custom rules never execute arbitrary code."
    >
      <Link href="/admin/data-quality">
        <MatrixButton variant="secondary">← Dashboard</MatrixButton>
      </Link>
      {error ? <p className="my-3 text-sm text-rose-300">{error}</p> : null}
      <MatrixCard title="Rules" className="mt-4">
        <ul className="divide-y divide-slate-800">
          {items.map((r) => (
            <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div>
                <p className="font-medium text-slate-100">
                  {r.name}{" "}
                  <span className="text-xs text-slate-500">({r.code})</span>
                </p>
                <p className="text-sm text-slate-400">{r.description}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {r.module} · {r.severity} ·{" "}
                  {r.isActive ? "Active" : "Disabled"} ·{" "}
                  {r.isSystemRule ? "System" : "Custom"}
                </p>
              </div>
              <div className="flex gap-2">
                {canEnable && !r.isActive ? (
                  <MatrixButton
                    variant="secondary"
                    onClick={async () => {
                      await fetch(`/api/data-quality/rules/${r.id}/enable`, {
                        method: "POST",
                      });
                      await load();
                    }}
                  >
                    Enable
                  </MatrixButton>
                ) : null}
                {canDisable && r.isActive ? (
                  <MatrixButton
                    variant="secondary"
                    onClick={async () => {
                      await fetch(`/api/data-quality/rules/${r.id}/disable`, {
                        method: "POST",
                      });
                      await load();
                    }}
                  >
                    Disable
                  </MatrixButton>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </MatrixCard>
    </AdminShell>
  );
}
