"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import AdminShell from "../../components/admin/AdminShell";
import MatrixAuthGuard from "../../components/MatrixAuthGuard";
import {
  MatrixButton,
  MatrixCard,
  MatrixStatCard,
} from "../../components/ui";
import {
  listAllMembershipsAdmin,
  listPortalAudit,
} from "@/lib/portal";
import { listCustomerStatusMappings } from "@/lib/portal/status-map";

export default function AdminPortalPage() {
  const [tick, setTick] = useState(0);
  const memberships = useMemo(() => {
    void tick;
    return listAllMembershipsAdmin();
  }, [tick]);
  const audit = useMemo(() => {
    void tick;
    return listPortalAudit(30);
  }, [tick]);
  const mappings = useMemo(() => listCustomerStatusMappings(), []);

  return (
    <AdminShell
      title="Customer portal administration"
      subtitle="Memberships, invitations, status labels, and portal audit (internal only)."
    >
      <MatrixAuthGuard requiredPermissions={["ADMINISTER_CUSTOMER_PORTAL"]}>
        <div className="mb-4">
          <MatrixButton href="/portal/dashboard" variant="secondary" size="md">
            Preview portal (safe)
          </MatrixButton>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <MatrixStatCard label="Memberships" value={memberships.length} />
          <MatrixStatCard
            label="Active"
            value={memberships.filter((m) => m.status === "ACTIVE").length}
          />
          <MatrixStatCard
            label="Disabled"
            value={memberships.filter((m) => m.status === "DISABLED").length}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <MatrixCard title="Customer users">
            <ul className="max-h-80 space-y-2 overflow-y-auto text-sm">
              {memberships.map((m) => (
                <li key={m.id} className="border-b border-slate-800 pb-2">
                  {m.displayName} · {m.customerId} · {m.role} · {m.status}
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="mt-2 text-xs text-cyan-300"
              onClick={() => setTick((t) => t + 1)}
            >
              Refresh
            </button>
          </MatrixCard>

          <MatrixCard title="Customer status labels">
            <ul className="max-h-80 space-y-1 overflow-y-auto text-xs text-slate-300">
              {mappings.map((m) => (
                <li key={m.internal}>
                  {m.internal} → {m.customer}
                </li>
              ))}
            </ul>
          </MatrixCard>

          <MatrixCard title="Portal audit" className="lg:col-span-2">
            <ul className="max-h-64 space-y-1 overflow-y-auto text-xs text-slate-400">
              {audit.map((a) => (
                <li key={a.id}>
                  {a.occurredAt.slice(0, 19)} · {a.actor} · {a.action} ·{" "}
                  {a.entityId}
                </li>
              ))}
            </ul>
          </MatrixCard>
        </div>

        <p className="mt-6 text-sm text-slate-500">
          Preview opens the customer portal UI. Destructive impersonation
          actions are not enabled.
          <Link href="/portal/dashboard" className="ml-2 text-cyan-300">
            Open preview
          </Link>
        </p>
      </MatrixAuthGuard>
    </AdminShell>
  );
}
