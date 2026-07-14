"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import AdminShell from "../../components/admin/AdminShell";
import { MatrixButton, MatrixCard, MatrixStatCard } from "../../components/ui";
import {
  hasMatrixPermission,
  resolveMatrixRole,
} from "@/lib/auth/permissions";
import type { VersionInformation } from "@/lib/admin/completion/version";

type VersionResponse = {
  ok: boolean;
  data?: VersionInformation;
  error?: string;
};

export default function AdminVersionPage() {
  const { user } = useUser();
  const { role } = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );
  const canView = hasMatrixPermission(role, "VIEW_VERSION_INFORMATION");
  const [data, setData] = useState<VersionInformation | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/version", { cache: "no-store" });
      const json = (await res.json()) as VersionResponse;
      if (!res.ok || !json.ok || !json.data) {
        setError(json.error ?? "Unable to load version information.");
        setData(null);
        return;
      }
      setData(json.data);
    } catch {
      setError("Unable to load version information.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    void load();
  }, [canView]);

  return (
    <AdminShell
      title="Version & Deployment"
      subtitle="Application version and release history from runtime metadata."
    >
      {!canView ? (
        <p className="text-sm text-rose-300" role="alert">
          You do not have permission to view version information.
        </p>
      ) : (
        <>
          <div className="mb-4">
            <MatrixButton
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => void load()}
            >
              Refresh
            </MatrixButton>
          </div>

          {loading ? (
            <p className="text-sm text-slate-400">Loading version information…</p>
          ) : error ? (
            <p className="text-sm text-rose-300" role="alert">
              {error}
            </p>
          ) : data ? (
            <>
              <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MatrixStatCard label="Version" value={data.version} />
                <MatrixStatCard label="Build" value={data.buildIdentifier} />
                <MatrixStatCard label="Environment" value={data.environment} />
                <MatrixStatCard label="Node" value={data.nodeVersion} />
              </div>

              <div className="mb-6 grid gap-6 lg:grid-cols-2">
                <MatrixCard title="Runtime">
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-400">Next runtime</dt>
                      <dd className="text-slate-100">{data.nextRuntime}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-400">Generated at</dt>
                      <dd className="text-slate-100">
                        {data.generatedAt.slice(0, 19).replace("T", " ")} UTC
                      </dd>
                    </div>
                  </dl>
                </MatrixCard>
                <MatrixCard title="Release history">
                  <ul className="space-y-3">
                    {data.releaseHistory.map((r) => (
                      <li
                        key={`${r.patchName}-${r.status}`}
                        className="rounded-lg border border-slate-800 px-3 py-2"
                      >
                        <p className="text-sm font-medium text-slate-100">
                          {r.patchName}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {r.version} · {r.status}
                          {r.migrationRequired ? " · Migration required" : ""}
                        </p>
                        <p className="mt-1 text-sm text-slate-300">{r.summary}</p>
                      </li>
                    ))}
                  </ul>
                </MatrixCard>
              </div>
            </>
          ) : null}
        </>
      )}
    </AdminShell>
  );
}
