"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import {
  hasMatrixPermission,
  resolveMatrixRole,
} from "@/lib/auth/permissions";
import { MatrixButton, MatrixCard } from "../../../components/ui";

export default function AutomationDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useUser();
  const { role } = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );
  const canView = hasMatrixPermission(role, "VIEW_AI_AUTOMATIONS");
  const canRun = hasMatrixPermission(role, "RUN_AI_AUTOMATIONS");
  const [automation, setAutomation] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!canView || !params.id) return;
    void fetch(`/api/ai-operations/automations/${params.id}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setAutomation(j.automation);
        else setError(j.error ?? "Not found");
      });
  }, [canView, params.id]);

  if (!canView) {
    return (
      <div className="p-8 text-rose-300">Permission denied.</div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-8">
      <Link href="/ai-operations/automations" className="text-sm text-cyan-300">
        ← Automations
      </Link>
      {error ? <p className="text-rose-300">{error}</p> : null}
      {message ? <p className="text-emerald-300">{message}</p> : null}
      {automation ? (
        <MatrixCard title={String(automation.name)}>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Status</dt>
              <dd className="text-white">{String(automation.status)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Trigger</dt>
              <dd className="text-white">
                {String(automation.triggerType)}
                {automation.eventType ? ` / ${String(automation.eventType)}` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Risk</dt>
              <dd className="text-white">{String(automation.riskLevel)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Approval</dt>
              <dd className="text-white">{String(automation.approvalMode)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-sm text-slate-300">{String(automation.description)}</p>
          <details className="mt-4 text-xs text-slate-400">
            <summary>Advanced config</summary>
            <pre className="mt-2 overflow-x-auto rounded bg-slate-950 p-3">
              {JSON.stringify(
                {
                  conditions: JSON.parse(String(automation.conditionsJson || "{}")),
                  actions: JSON.parse(String(automation.actionsJson || "[]")),
                },
                null,
                2,
              )}
            </pre>
          </details>
          {canRun ? (
            <div className="mt-4">
              <MatrixButton
                onClick={() =>
                  void fetch(`/api/ai-operations/automations/${params.id}/run`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ dryRun: true }),
                  })
                    .then((r) => r.json())
                    .then((j) =>
                      setMessage(
                        j.ok ? `Dry-run ${j.status}` : j.error ?? "Failed",
                      ),
                    )
                }
              >
                Dry run
              </MatrixButton>
            </div>
          ) : null}
        </MatrixCard>
      ) : (
        <p className="text-slate-400">Loading…</p>
      )}
    </div>
  );
}
