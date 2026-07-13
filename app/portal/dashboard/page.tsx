"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  MatrixButton,
  MatrixCard,
  MatrixStatCard,
} from "../../components/ui";
import PortalShell from "../PortalShell";
import {
  getPortalDashboard,
  listPortalAnnouncements,
  listPortalTickets,
  setActivePortalMembership,
  listAllMembershipsAdmin,
} from "@/lib/portal";

export default function PortalDashboardPage() {
  const [tick, setTick] = useState(0);
  const memberships = useMemo(() => {
    void tick;
    return listAllMembershipsAdmin().filter((m) => m.status === "ACTIVE");
  }, [tick]);

  const metrics = useMemo(() => {
    void tick;
    return getPortalDashboard();
  }, [tick]);

  const tickets = useMemo(() => {
    void tick;
    return listPortalTickets({ statusGroup: "OPEN" }).slice(0, 5);
  }, [tick]);

  const announcements = useMemo(() => {
    void tick;
    return listPortalAnnouncements().slice(0, 3);
  }, [tick]);

  return (
    <PortalShell title="Dashboard">
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <label className="text-xs text-slate-400" htmlFor="portal-user">
          Dev membership
        </label>
        <select
          id="portal-user"
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
          onChange={(e) => {
            setActivePortalMembership(e.target.value);
            setTick((t) => t + 1);
          }}
          defaultValue="mem-sfx-admin"
        >
          {memberships.map((m) => (
            <option key={m.id} value={m.id}>
              {m.displayName} ({m.role})
            </option>
          ))}
        </select>
      </div>

      {metrics ? (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MatrixStatCard label="Active printers" value={metrics.activePrinters} />
          <MatrixStatCard label="Open tickets" value={metrics.openTickets} />
          <MatrixStatCard label="Critical" value={metrics.criticalTickets} />
          <MatrixStatCard label="Waiting for parts" value={metrics.waitingForParts} />
          <MatrixStatCard label="Scheduled" value={metrics.technicianScheduled} />
          <MatrixStatCard label="Resolved this month" value={metrics.resolvedThisMonth} />
          <MatrixStatCard label="Upcoming PMs" value={metrics.upcomingPMs} />
          <MatrixStatCard label="Documents" value={metrics.newDocuments} />
        </div>
      ) : (
        <p className="mb-6 text-rose-300">Portal access denied — select an active membership.</p>
      )}

      <div className="mb-8 flex flex-wrap gap-2">
        <MatrixButton href="/portal/tickets/new" variant="primary" size="md">
          Create Service Ticket
        </MatrixButton>
        <MatrixButton href="/portal/tickets" variant="secondary" size="md">
          View Open Tickets
        </MatrixButton>
        <MatrixButton href="/portal/printers" variant="secondary" size="md">
          View Printers
        </MatrixButton>
        <MatrixButton href="/portal/reports" variant="secondary" size="md">
          Download Reports
        </MatrixButton>
        <MatrixButton href="/portal/help" variant="secondary" size="md">
          Contact Service Team
        </MatrixButton>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <MatrixCard title="Current service activity" subtitle="Recently updated tickets">
          <ul className="divide-y divide-slate-800 text-sm">
            {tickets.map((t) => (
              <li key={t.id} className="py-3">
                <Link href={`/portal/tickets/${t.id}`} className="font-medium text-cyan-300">
                  {t.ticketNumber}
                </Link>
                <p className="text-slate-300">{t.problemTitle}</p>
                <p className="text-xs text-slate-500">
                  {t.customerStatus} · {t.locationName}
                </p>
              </li>
            ))}
            {tickets.length === 0 ? (
              <li className="py-3 text-slate-400">No open tickets.</li>
            ) : null}
          </ul>
        </MatrixCard>

        <MatrixCard title="Announcements">
          <ul className="space-y-3 text-sm">
            {announcements.map((a) => (
              <li key={a.id} className="rounded-lg border border-slate-800 p-3">
                <p className="font-medium text-white">{a.title}</p>
                <p className="text-slate-400">{a.message}</p>
              </li>
            ))}
          </ul>
          <Link href="/portal/announcements" className="mt-3 inline-block text-sm text-cyan-300">
            All announcements →
          </Link>
        </MatrixCard>
      </div>
    </PortalShell>
  );
}
