"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import AdminShell from "../../components/admin/AdminShell";
import HighRiskConfirmDialog from "../../components/admin/HighRiskConfirmDialog";
import { MatrixButton, MatrixCard } from "../../components/ui";
import {
  hasMatrixPermission,
  resolveMatrixRole,
} from "@/lib/auth/permissions";
import {
  ADMIN_TOOLS,
  runAdminTool,
  type AdminToolDefinition,
} from "@/lib/admin/completion/admin-tools";

export default function AdminToolsPage() {
  const { user } = useUser();
  const { role } = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );
  const canView = hasMatrixPermission(role, "VIEW_ADMIN_TOOLS");
  const actor =
    user?.fullName ||
    user?.primaryEmailAddress?.emailAddress ||
    "Administrator";

  const [pending, setPending] = useState<AdminToolDefinition | null>(null);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState("");
  const [details, setDetails] = useState<string[]>([]);

  const tools = ADMIN_TOOLS.filter((t) => hasMatrixPermission(role, t.permission));

  function runTool(tool: AdminToolDefinition, reason?: string) {
    setError("");
    setSummary("");
    setDetails([]);
    const result = runAdminTool(tool.id, actor, {
      confirm: tool.highRisk ? true : undefined,
      reason: tool.highRisk ? reason : undefined,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSummary(result.summary);
    setDetails(result.details);
  }

  function onRunClick(tool: AdminToolDefinition) {
    if (tool.highRisk) {
      setPending(tool);
      return;
    }
    runTool(tool);
  }

  return (
    <AdminShell
      title="Admin Tools"
      subtitle="Safe diagnostic and maintenance tools. High-risk actions require confirmation. No SQL shell or arbitrary commands."
    >
      {!canView ? (
        <p className="text-sm text-rose-300" role="alert">
          You do not have permission to view admin tools.
        </p>
      ) : (
        <>
          {error ? (
            <p className="mb-3 text-sm text-rose-300" role="alert">
              {error}
            </p>
          ) : null}

          <div className="mb-6 space-y-3">
            {tools.map((tool) => (
              <MatrixCard
                key={tool.id}
                title={tool.name}
                subtitle={`Impact: ${tool.impact}${tool.highRisk ? " · High-risk" : ""}`}
                actions={
                  <MatrixButton
                    type="button"
                    size="sm"
                    variant={tool.highRisk ? "secondary" : "primary"}
                    onClick={() => onRunClick(tool)}
                  >
                    Run
                  </MatrixButton>
                }
              >
                <p className="text-sm text-slate-300">{tool.description}</p>
              </MatrixCard>
            ))}
            {tools.length === 0 ? (
              <p className="text-sm text-slate-500">
                No admin tools are available for your role.
              </p>
            ) : null}
          </div>

          {summary ? (
            <MatrixCard title="Result summary">
              <p className="text-sm text-emerald-200">{summary}</p>
              {details.length > 0 ? (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-300">
                  {details.map((d, i) => (
                    <li key={`${i}-${d.slice(0, 24)}`}>{d}</li>
                  ))}
                </ul>
              ) : null}
            </MatrixCard>
          ) : null}

          <HighRiskConfirmDialog
            open={Boolean(pending)}
            title={pending ? `Run ${pending.name}` : "Confirm admin tool"}
            summary={
              pending?.description ??
              "This high-risk admin tool requires explicit confirmation."
            }
            requireReason
            confirmLabel="Run tool"
            onCancel={() => setPending(null)}
            onConfirm={async (reason) => {
              if (!pending) return;
              runTool(pending, reason);
              setPending(null);
            }}
          />
        </>
      )}
    </AdminShell>
  );
}
