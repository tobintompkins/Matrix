"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
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

type ApiDash = {
  metrics?: {
    openServiceRequests: number;
    equipmentOnline: number;
    upcomingPmVisits: number;
    openPartsRequests: number;
    unreadNotifications: number;
    criticalTickets: number;
  };
  recentServiceRequests?: Array<{
    id: string;
    ticketNumber: string;
    issueSummary: string;
    status: string;
    locationName: string;
  }>;
  upcomingPm?: Array<{
    machineId: string;
    machineName: string;
    status: string;
    estimatedDate: string | null;
  }>;
  equipmentHealth?: Array<{
    id: string;
    name: string;
    model: string;
    operationalStatus: string;
  }>;
};

export default function PortalDashboardPage() {
  const [tick, setTick] = useState(0);
  const [apiDash, setApiDash] = useState<ApiDash | null>(null);
  const [assistQ, setAssistQ] = useState("My printer will not print — what should I check?");
  const [assistA, setAssistA] = useState("");
  const [assistLoading, setAssistLoading] = useState(false);

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

  const loadApi = useCallback(async () => {
    try {
      const res = await fetch("/api/portal/dashboard", { cache: "no-store" });
      const json = await res.json();
      if (res.ok && json.ok) setApiDash(json);
    } catch {
      /* client store fallback remains */
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void loadApi());
  }, [loadApi, tick]);

  async function askAssist() {
    setAssistLoading(true);
    setAssistA("");
    try {
      const res = await fetch("/api/portal/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: assistQ }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Assist unavailable");
      setAssistA(json.answer);
    } catch (e) {
      setAssistA(e instanceof Error ? e.message : "Assist unavailable");
    } finally {
      setAssistLoading(false);
    }
  }

  const openCount =
    apiDash?.metrics?.openServiceRequests ?? metrics?.openTickets ?? 0;
  const machines =
    apiDash?.metrics?.equipmentOnline ?? metrics?.activePrinters ?? 0;
  const pmCount =
    apiDash?.metrics?.upcomingPmVisits ?? metrics?.upcomingPMs ?? 0;
  const partsCount = apiDash?.metrics?.openPartsRequests ?? 0;
  const unread = apiDash?.metrics?.unreadNotifications ?? metrics?.unreadNotifications ?? 0;

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

      {metrics || apiDash ? (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MatrixStatCard label="My Machines" value={machines} />
          <MatrixStatCard label="Open Service Requests" value={openCount} />
          <MatrixStatCard label="Upcoming PM" value={pmCount} />
          <MatrixStatCard label="Parts Requests" value={partsCount} />
          <MatrixStatCard label="Notifications" value={unread} />
          <MatrixStatCard
            label="Critical"
            value={apiDash?.metrics?.criticalTickets ?? metrics?.criticalTickets ?? 0}
          />
        </div>
      ) : (
        <p className="mb-6 text-rose-300">
          Portal access denied — select an active membership.
        </p>
      )}

      <div className="mb-8 flex flex-wrap gap-2">
        <MatrixButton href="/portal/tickets/new" variant="primary" size="md">
          Request Service
        </MatrixButton>
        <MatrixButton href="/portal/printers" variant="secondary" size="md">
          View Machine
        </MatrixButton>
        <MatrixButton href="/portal/tickets" variant="secondary" size="md">
          Check Existing Request
        </MatrixButton>
        <MatrixButton href="/portal/parts" variant="secondary" size="md">
          Request Parts
        </MatrixButton>
        <MatrixButton href="/portal/maintenance" variant="secondary" size="md">
          View PM Schedule
        </MatrixButton>
        <MatrixButton href="/portal/help" variant="secondary" size="md">
          Open Support Assistant
        </MatrixButton>
      </div>

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <MatrixCard title="Open service requests">
          <ul className="divide-y divide-slate-800 text-sm">
            {(apiDash?.recentServiceRequests ?? tickets.map((t) => ({
              id: t.id,
              ticketNumber: t.ticketNumber,
              issueSummary: t.problemTitle,
              status: t.customerStatus,
              locationName: t.locationName,
            }))).map((t) => (
              <li key={t.id} className="py-3">
                <Link
                  href={`/portal/tickets/${t.id}`}
                  className="font-medium text-cyan-300"
                >
                  {t.ticketNumber}
                </Link>
                <p className="text-slate-300">{t.issueSummary}</p>
                <p className="text-xs text-slate-500">
                  {t.status} · {t.locationName}
                </p>
              </li>
            ))}
            {(apiDash?.recentServiceRequests?.length ?? tickets.length) === 0 ? (
              <li className="py-3 text-slate-400">No open requests.</li>
            ) : null}
          </ul>
        </MatrixCard>

        <MatrixCard title="Upcoming PM">
          <ul className="space-y-2 text-sm text-slate-300">
            {(apiDash?.upcomingPm ?? []).slice(0, 5).map((p) => (
              <li key={p.machineId}>
                <Link
                  href={`/portal/printers/${encodeURIComponent(p.machineId)}`}
                  className="text-cyan-300 hover:underline"
                >
                  {p.machineName}
                </Link>
                <span className="text-slate-500">
                  {" "}
                  · {p.status}
                  {p.estimatedDate ? ` · ${p.estimatedDate.slice(0, 10)}` : ""}
                </span>
              </li>
            ))}
            {(apiDash?.upcomingPm?.length ?? 0) === 0 ? (
              <li className="text-slate-400">
                No upcoming PM rows.{" "}
                <Link href="/portal/maintenance" className="text-cyan-300">
                  View PM schedule
                </Link>
              </li>
            ) : null}
          </ul>
        </MatrixCard>

        <MatrixCard title="My machines">
          <ul className="space-y-2 text-sm text-slate-300">
            {(apiDash?.equipmentHealth ?? []).slice(0, 5).map((m) => (
              <li key={m.id}>
                <Link
                  href={`/portal/printers/${encodeURIComponent(m.id)}`}
                  className="text-cyan-300 hover:underline"
                >
                  {m.name}
                </Link>
                <span className="text-slate-500">
                  {" "}
                  · {m.model} · {m.operationalStatus}
                </span>
              </li>
            ))}
            {(apiDash?.equipmentHealth?.length ?? 0) === 0 ? (
              <li className="text-slate-400">
                <Link href="/portal/printers" className="text-cyan-300">
                  Browse equipment
                </Link>
              </li>
            ) : null}
          </ul>
        </MatrixCard>

        <MatrixCard title="Announcements & notifications">
          <ul className="space-y-3 text-sm">
            {announcements.map((a) => (
              <li key={a.id} className="rounded-lg border border-slate-800 p-3">
                <p className="font-medium text-slate-200">{a.title}</p>
                <p className="text-slate-400">{a.message}</p>
              </li>
            ))}
            <li>
              <Link href="/portal/notifications" className="text-cyan-300">
                Open notification center
              </Link>
            </li>
          </ul>
        </MatrixCard>
      </div>

      <MatrixCard title="Matrix Assist — customer support">
        <p className="mb-3 text-sm text-slate-400">
          Restricted customer mode: safe checks, status explanations, and links to
          submit service — never internal procedures or costs.
        </p>
        <textarea
          className="min-h-20 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
          value={assistQ}
          onChange={(e) => setAssistQ(e.target.value)}
          aria-label="Ask Matrix Assist"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <MatrixButton
            type="button"
            variant="primary"
            size="md"
            disabled={assistLoading}
            onClick={() => void askAssist()}
          >
            {assistLoading ? "Thinking…" : "Ask Assist"}
          </MatrixButton>
          <MatrixButton href="/portal/tickets/new" variant="secondary" size="md">
            Request Service
          </MatrixButton>
        </div>
        {assistA ? (
          <p className="mt-4 text-sm text-slate-300">{assistA}</p>
        ) : null}
      </MatrixCard>
    </PortalShell>
  );
}
