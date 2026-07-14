"use client";

import { useEffect, useState } from "react";
import AdminShell from "../../components/admin/AdminShell";
import HighRiskConfirmDialog from "../../components/admin/HighRiskConfirmDialog";
import { MatrixButton, MatrixCard } from "../../components/ui";

type Feature = {
  id: string;
  featureKey: string;
  enabled: boolean;
  description: string | null;
};

export default function AdminFeaturesPage() {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [pending, setPending] = useState<Feature | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    const res = await fetch("/api/admin/features", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setError(data.error ?? "Unable to load feature controls.");
      return;
    }
    setFeatures(data.features);
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <AdminShell
      title="Feature Controls"
      subtitle="Organization-scoped feature toggles. Disabling a feature does not delete existing data."
    >
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
        {features.map((f) => (
          <MatrixCard
            key={f.id}
            title={f.featureKey}
            subtitle={f.description ?? undefined}
            actions={
              <MatrixButton
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setPending(f)}
              >
                {f.enabled ? "Disable" : "Enable"}
              </MatrixButton>
            }
          >
            <p className="text-sm text-slate-300">
              Status: {f.enabled ? "Enabled" : "Disabled"}
            </p>
          </MatrixCard>
        ))}
      </div>

      <HighRiskConfirmDialog
        open={Boolean(pending)}
        title={pending?.enabled ? "Disable feature" : "Enable feature"}
        summary={
          pending?.featureKey === "matrix_assist" && pending.enabled
            ? "Disabling Matrix Assist will remove new AI assistance actions. Existing diagnostic history will remain available to authorized users."
            : `Change feature "${pending?.featureKey ?? ""}" state. Existing data is retained.`
        }
        currentValue={pending?.enabled ? "Enabled" : "Disabled"}
        proposedValue={pending?.enabled ? "Disabled" : "Enabled"}
        requireReason={false}
        onCancel={() => setPending(null)}
        onConfirm={async () => {
          if (!pending) return;
          const res = await fetch("/api/admin/features", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: pending.id,
              enabled: !pending.enabled,
            }),
          });
          const data = await res.json();
          if (!res.ok || !data.ok) {
            setError(data.error ?? "Unable to update feature control.");
            return;
          }
          setNotice(data.notice ?? "Feature updated.");
          setPending(null);
          await load();
        }}
      />
    </AdminShell>
  );
}
