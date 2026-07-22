"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import AdminShell from "../../../components/admin/AdminShell";
import { MatrixButton, MatrixCard } from "../../../components/ui";
import {
  hasMatrixPermission,
  resolveMatrixRole,
} from "@/lib/auth/permissions";

type Alert = {
  id: string;
  severity: string;
  title: string;
  description: string;
  status: string;
  recommendedAction?: string | null;
};

export default function OrganizationHealthAlertsPage() {
  const { user } = useUser();
  const { role } = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );
  const canView = hasMatrixPermission(role, "VIEW_PREDICTIVE_ALERTS");
  const canAck = hasMatrixPermission(role, "ACKNOWLEDGE_HEALTH_ALERTS");
  const canResolve = hasMatrixPermission(role, "RESOLVE_HEALTH_ALERTS");
  const [items, setItems] = useState<Alert[]>([]);
  const [notice, setNotice] = useState("");

  async function load() {
    const res = await fetch("/api/organization-health/alerts", {
      cache: "no-store",
    });
    const json = await res.json();
    if (json.ok) setItems(json.items ?? []);
  }

  useEffect(() => {
    if (!canView) return;
    const t = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [canView]);

  async function act(id: string, action: "acknowledge" | "resolve" | "dismiss") {
    const body =
      action === "acknowledge"
        ? {}
        : action === "resolve"
          ? { resolutionNote: window.prompt("Resolution note") ?? "" }
          : { reason: window.prompt("Dismiss reason") ?? "" };
    if (
      (action === "resolve" || action === "dismiss") &&
      !(body as { resolutionNote?: string; reason?: string }).resolutionNote &&
      !(body as { reason?: string }).reason
    ) {
      setNotice("A note/reason is required.");
      return;
    }
    const res = await fetch(
      `/api/organization-health/alerts/${id}/${action}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    const json = await res.json();
    setNotice(json.ok ? `${action} saved` : json.error ?? "Failed");
    await load();
  }

  if (!canView) {
    return (
      <AdminShell title="Operational Alerts">
        <p className="text-sm text-rose-300">Permission denied.</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell title="Operational Alerts" subtitle="Rules-based early warnings">
      <Link href="/admin/organization-health" className="mb-4 inline-block text-sm text-cyan-300">
        ← Organization Health
      </Link>
      {notice ? <p className="mb-3 text-sm text-cyan-200">{notice}</p> : null}
      <ul className="space-y-3">
        {items.map((a) => (
          <li key={a.id}>
            <MatrixCard title={`${a.severity} · ${a.title}`} subtitle={a.status}>
              <p className="text-sm text-slate-300">{a.description}</p>
              {a.recommendedAction ? (
                <p className="mt-1 text-xs text-cyan-200">{a.recommendedAction}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {canAck ? (
                  <MatrixButton
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => void act(a.id, "acknowledge")}
                  >
                    Acknowledge
                  </MatrixButton>
                ) : null}
                {canResolve ? (
                  <>
                    <MatrixButton
                      type="button"
                      size="sm"
                      variant="success"
                      onClick={() => void act(a.id, "resolve")}
                    >
                      Resolve
                    </MatrixButton>
                    <MatrixButton
                      type="button"
                      size="sm"
                      variant="danger"
                      onClick={() => void act(a.id, "dismiss")}
                    >
                      Dismiss
                    </MatrixButton>
                  </>
                ) : null}
              </div>
            </MatrixCard>
          </li>
        ))}
      </ul>
      {items.length === 0 ? (
        <p className="text-sm text-slate-400">No alerts.</p>
      ) : null}
    </AdminShell>
  );
}
