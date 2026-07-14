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
  listIntegrations,
  testIntegrationConnection,
  type IntegrationCard,
} from "@/lib/admin/completion/integrations";

export default function AdminIntegrationsPage() {
  const { user } = useUser();
  const { role } = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );
  const canView = hasMatrixPermission(role, "VIEW_INTEGRATIONS");
  const [items, setItems] = useState<IntegrationCard[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!canView) return;
    setItems(listIntegrations());
  }, [canView]);

  function onTest(key: string) {
    setError("");
    setNotice("");
    const result = testIntegrationConnection(key);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNotice(result.summary);
  }

  return (
    <AdminShell
      title="Integrations"
      subtitle="Existing Matrix integrations only. Secret values are never displayed."
    >
      {!canView ? (
        <p className="text-sm text-rose-300" role="alert">
          You do not have permission to view integrations.
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

          <div className="space-y-3">
            {items.map((item) => (
              <MatrixCard
                key={item.key}
                title={item.name}
                subtitle={`${item.category} · Status: ${item.status}`}
                actions={
                  item.canTest ? (
                    <MatrixButton
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => onTest(item.key)}
                    >
                      Test connection
                    </MatrixButton>
                  ) : undefined
                }
              >
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-slate-500">Environment</dt>
                    <dd className="text-slate-200">{item.environment}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Secret configured</dt>
                    <dd className="text-slate-200">
                      {item.secretConfigured ? "Yes" : "No"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Configuration owner</dt>
                    <dd className="text-slate-200">{item.configurationOwner}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Last successful connection</dt>
                    <dd className="text-slate-200">
                      {item.lastSuccessfulConnection ?? "Not recorded"}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-slate-500">Documentation</dt>
                    <dd className="text-slate-300">{item.documentation}</dd>
                  </div>
                  {item.lastError ? (
                    <div className="sm:col-span-2">
                      <dt className="text-slate-500">Last error</dt>
                      <dd className="text-rose-300">{item.lastError}</dd>
                    </div>
                  ) : null}
                </dl>
              </MatrixCard>
            ))}
          </div>
        </>
      )}
    </AdminShell>
  );
}
