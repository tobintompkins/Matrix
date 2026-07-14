"use client";

import Link from "next/link";
import { use, useMemo } from "react";
import MatrixShell from "@/app/components/MatrixShell";
import {
  MatrixButton,
  MatrixCard,
  MatrixEmptyState,
  MatrixPageHeader,
  MatrixStatCard,
  MatrixStatusBadge,
} from "@/app/components/ui";
import { getSite, getSiteDashboard, listAssets } from "@/lib/crm";

function badge(status: string) {
  switch (status) {
    case "ACTIVE":
      return "completed" as const;
    case "MAINTENANCE":
    case "LOANER":
      return "warning" as const;
    case "DOWN":
    case "DECOMMISSIONED":
      return "error" as const;
    default:
      return "offline" as const;
  }
}

export default function SiteDetailPage({
  params,
}: {
  params: Promise<{ id: string; siteId: string }>;
}) {
  const { id, siteId } = use(params);

  const site = useMemo(() => getSite(siteId), [siteId]);
  const dashboard = useMemo(() => getSiteDashboard(siteId), [siteId]);
  const printers = useMemo(
    () => listAssets({ siteId, customerId: id }).items,
    [siteId, id],
  );

  if (!site || site.customerId !== id) {
    return (
      <MatrixShell title="Site" activePath="/customers">
        <MatrixEmptyState
          title="Site not found"
          description="Return to the customer record."
          actionLabel="Back"
          onAction={() => {
            window.location.href = `/customers/${id}`;
          }}
        />
      </MatrixShell>
    );
  }

  return (
    <MatrixShell title={site.name} activePath="/customers">
      <MatrixPageHeader
        title={site.name}
        subtitle={`${site.siteNumber} · ${site.physicalAddress}`}
        breadcrumbs={["Matrix", "Customers", "Sites", site.name]}
        actions={
          <MatrixButton href={`/customers/${id}`} variant="secondary" size="md">
            Back to customer
          </MatrixButton>
        }
      />

      {dashboard ? (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MatrixStatCard label="Printers" value={dashboard.printerCount} />
          <MatrixStatCard
            label="Fleet health"
            value={dashboard.fleetHealthPct == null ? "—" : `${dashboard.fleetHealthPct}%`}
          />
          <MatrixStatCard label="Open WOs" value={dashboard.openWorkOrders} />
          <MatrixStatCard label="Scheduled visits" value={dashboard.scheduledVisits} />
          <MatrixStatCard label="Upcoming PMs" value={dashboard.upcomingPMs} />
          <MatrixStatCard label="Recent repairs" value={dashboard.recentRepairs} />
          <MatrixStatCard label="Parts consumed" value={dashboard.partsConsumed} />
          <MatrixStatCard
            label="Monthly volume"
            value={dashboard.monthlyVolume.toLocaleString()}
          />
          <MatrixStatCard label="Technician" value={dashboard.technicianAssigned || "—"} />
        </div>
      ) : null}

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <MatrixCard title="Access & logistics">
          <dl className="space-y-2 text-sm text-slate-300">
            <div>
              <dt className="text-xs text-slate-500">Business hours</dt>
              <dd>{site.businessHours}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Loading dock</dt>
              <dd>{site.loadingDockInstructions || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Parking</dt>
              <dd>{site.parkingInstructions || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Security</dt>
              <dd>{site.securityProcedures || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Building access</dt>
              <dd>{site.buildingAccessInstructions || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">After hours</dt>
              <dd>{site.afterHoursAccess || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">GPS</dt>
              <dd>
                {site.latitude != null && site.longitude != null
                  ? `${site.latitude}, ${site.longitude}`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Notes</dt>
              <dd>{site.siteNotes || "—"}</dd>
            </div>
          </dl>
        </MatrixCard>

        <MatrixCard title="Printers at this site">
          {printers.length === 0 ? (
            <MatrixEmptyState title="No printers" description="Assign assets to this site." />
          ) : (
            <ul className="divide-y divide-slate-800 text-sm">
              {printers.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 py-3">
                  <Link
                    href={`/customers/${id}/assets/${a.id}`}
                    className="font-medium text-cyan-300 hover:text-cyan-200"
                  >
                    {a.assetNumber} · {a.model}
                  </Link>
                  <MatrixStatusBadge label={a.status} variant={badge(a.status)} />
                </li>
              ))}
            </ul>
          )}
        </MatrixCard>
      </div>
    </MatrixShell>
  );
}
