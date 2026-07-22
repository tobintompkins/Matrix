"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import {
  hasMatrixPermission,
  resolveMatrixRole,
} from "@/lib/auth/permissions";
import MatrixShell from "@/app/components/MatrixShell";
import MatrixAuthGuard from "@/app/components/MatrixAuthGuard";
import { MatrixButton, MatrixCard } from "@/app/components/ui";
import ExecutiveNav from "../ExecutiveNav";

type AlertItem = {
  id: string;
  severity: string;
  category: string;
  title: string;
  explanation: string;
  entityLabel: string | null;
  href: string | null;
  recommendedAction: string | null;
  status: string;
  detectedAt: string;
  ownerName: string | null;
};

function Body() {
  const { user } = useUser();
  const { role } = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );
  const canManage = hasMatrixPermission(role, "MANAGE_EXECUTIVE_ALERTS");
  const router = useRouter();
  const searchParams = useSearchParams();
  const range = searchParams.get("range") || "LAST_30";
  const status = searchParams.get("status") || "";
  const [items, setItems] = useState<AlertItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams();
      qs.set("refresh", "1");
      if (status) qs.set("status", status);
      const res = await fetch(
        `/api/executive-command-center/alerts?${qs.toString()}`,
        { cache: "no-store" },
      );
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Failed");
      setItems(json.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  async function act(action: string, id: string) {
    await fetch("/api/executive-command-center/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, id }),
    });
    await load();
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-1 py-2">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">
            Alerts &amp; Actions
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Consolidated executive inbox from service, PM, inventory, predictive,
            and Decision Engine signals — not a second alert engine.
          </p>
        </div>
        <MatrixButton type="button" variant="secondary" onClick={() => void load()}>
          Refresh
        </MatrixButton>
      </header>
      <ExecutiveNav
        range={range}
        onRangeChange={(next) => {
          const p = new URLSearchParams(searchParams.toString());
          p.set("range", next);
          router.push(`?${p.toString()}`);
        }}
      />
      <label className="flex items-center gap-2 text-sm text-slate-400">
        Status
        <select
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-slate-200"
          value={status}
          onChange={(e) => {
            const p = new URLSearchParams(searchParams.toString());
            if (e.target.value) p.set("status", e.target.value);
            else p.delete("status");
            router.push(`?${p.toString()}`);
          }}
        >
          <option value="">All</option>
          <option value="OPEN">Open</option>
          <option value="ACKNOWLEDGED">Acknowledged</option>
          <option value="RESOLVED">Resolved</option>
          <option value="DISMISSED">Dismissed</option>
        </select>
      </label>
      {error ? (
        <p className="text-sm text-rose-200">{error}</p>
      ) : null}
      {loading ? <div className="h-32 animate-pulse rounded-xl bg-slate-800/60" /> : null}
      <div className="space-y-3">
        {items.length === 0 && !loading ? (
          <MatrixCard className="p-4 text-sm text-slate-400">
            No executive alerts in this filter. Refresh to sync from live modules.
          </MatrixCard>
        ) : null}
        {items.map((a) => (
          <MatrixCard key={a.id} className="space-y-2 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase text-amber-300">{a.severity}</span>
              <span className="text-xs text-slate-500">{a.category}</span>
              <span className="text-xs text-slate-500">{a.status}</span>
            </div>
            <h2 className="text-lg font-medium text-slate-100">
              {a.href ? (
                <Link href={a.href} className="hover:text-cyan-300">
                  {a.title}
                </Link>
              ) : (
                a.title
              )}
            </h2>
            <p className="text-sm text-slate-400">{a.explanation}</p>
            {a.recommendedAction ? (
              <p className="text-sm text-cyan-200/80">
                Recommended: {a.recommendedAction}
              </p>
            ) : null}
            <p className="text-xs text-slate-500">
              Detected {new Date(a.detectedAt).toLocaleString()}
              {a.entityLabel ? ` · ${a.entityLabel}` : ""}
              {a.ownerName ? ` · Owner ${a.ownerName}` : ""}
            </p>
            {canManage && (a.status === "OPEN" || a.status === "ACKNOWLEDGED") ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {a.status === "OPEN" ? (
                  <MatrixButton
                    type="button"
                    variant="secondary"
                    onClick={() => void act("acknowledge", a.id)}
                  >
                    Acknowledge
                  </MatrixButton>
                ) : null}
                <MatrixButton
                  type="button"
                  variant="secondary"
                  onClick={() => void act("resolve", a.id)}
                >
                  Resolve
                </MatrixButton>
                <MatrixButton
                  type="button"
                  variant="secondary"
                  onClick={() => void act("dismiss", a.id)}
                >
                  Dismiss
                </MatrixButton>
              </div>
            ) : null}
          </MatrixCard>
        ))}
      </div>
    </div>
  );
}

export default function ExecutiveAlertsPage() {
  return (
    <MatrixShell title="Alerts & Actions" activePath="/executive-command-center">
      <MatrixAuthGuard requiredPermissions={["VIEW_EXECUTIVE_COMMAND_CENTER"]}>
        <Suspense fallback={<p className="text-sm text-slate-400">Loading…</p>}>
          <Body />
        </Suspense>
      </MatrixAuthGuard>
    </MatrixShell>
  );
}
