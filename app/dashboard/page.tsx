"use client";

import { useEffect, useMemo, useState } from "react";
import ContextPanel from "../components/ContextPanel";
import MatrixShell from "../components/MatrixShell";
import FleetCopyCountsCard from "../components/maintenance/FleetCopyCountsCard";
import PmDashboardSummaryCard from "../components/maintenance/PmDashboardSummaryCard";
import {
  MatrixButton,
  MatrixInfoPanel,
  MatrixSearchBar,
  MatrixSection,
} from "../components/ui";
import DashboardActivityTable, {
  type ActivityRow,
} from "./DashboardActivityTable";
import DashboardOpsPanel from "./DashboardOpsPanel";
import ServiceHubWelcome from "./ServiceHubWelcome";
import { listServiceCalls, subscribeServiceCalls } from "@/lib/service-calls";

function buildRecentActivity(): ActivityRow[] {
  const openish = new Set([
    "NEW",
    "UNASSIGNED",
    "ASSIGNED",
    "ACCEPTED",
    "EN_ROUTE",
    "ON_SITE",
    "DIAGNOSING",
    "WAITING_FOR_PARTS",
    "WAITING_FOR_CUSTOMER",
    "ESCALATED",
    "RESOLVED",
    "CLOSED",
  ]);

  return listServiceCalls()
    .filter((c) => openish.has(c.status) && !c.isDraft)
    .slice()
    .sort(
      (a, b) =>
        new Date(b.updatedAt || b.createdAt).getTime() -
        new Date(a.updatedAt || a.createdAt).getTime(),
    )
    .slice(0, 10)
    .map((c) => ({
      date: (c.updatedAt || c.createdAt).slice(0, 10),
      customer: c.machine.customerName,
      printer: `${c.machine.assetTag || c.machine.serialNumber} (${c.machine.printerModel})`,
      issue: c.problem.issueTitle,
      status:
        c.status === "RESOLVED" || c.status === "CLOSED"
          ? "Completed"
          : c.status === "WAITING_FOR_PARTS"
            ? "Waiting Parts"
            : c.status === "ON_SITE" || c.status === "DIAGNOSING"
              ? "In Progress"
              : "Open",
    }));
}

/**
 * Patch 47 — Service Hub (existing /dashboard page).
 * Single H1 comes from MatrixShell ("Service Hub"); page content does not repeat it.
 */
export default function DashboardPage() {
  const [tick, setTick] = useState(0);
  useEffect(() => subscribeServiceCalls(() => setTick((t) => t + 1)), []);
  const recentActivity = useMemo(() => {
    void tick;
    return buildRecentActivity();
  }, [tick]);

  return (
    <MatrixShell title="Service Hub" activePath="/dashboard">
      <nav
        aria-label="Breadcrumb"
        className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-500"
      >
        <span>Matrix</span>
        <span aria-hidden>/</span>
        <span>Service Platform</span>
        <span aria-hidden>/</span>
        <span className="text-cyan-400">Service Hub</span>
      </nav>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <ServiceHubWelcome />
        <div className="flex flex-wrap gap-2">
          <MatrixButton href="/service-calls/new" variant="primary" size="md">
            Create Service Call
          </MatrixButton>
          <MatrixButton href="/order-parts" variant="secondary" size="md">
            Order Parts
          </MatrixButton>
        </div>
      </div>

      <div className="mb-6">
        <DashboardOpsPanel />
      </div>

      <div className="mb-6">
        <PmDashboardSummaryCard />
      </div>

      <ContextPanel className="mb-6" />

      <div className="mb-6">
        <MatrixSearchBar
          id="global-search"
          placeholder="Search printers, customers, tickets, serial numbers…"
          aria-label="Search Service Hub"
        />
      </div>

      <div className="mb-6">
        <FleetCopyCountsCard />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <MatrixSection
          title="Recent Activity"
          subtitle="Newest service-call updates first (limited to 10)."
          className="lg:col-span-2"
        >
          {recentActivity.length === 0 ? (
            <p className="text-sm text-slate-500">No open service calls.</p>
          ) : (
            <div className="overflow-x-auto">
              <DashboardActivityTable data={recentActivity} />
            </div>
          )}
        </MatrixSection>

        <MatrixInfoPanel
          title="Navigation tips"
          subtitle="Use the sidebar to open existing modules. This page reuses live data — no duplicate landing page."
        >
          <ul className="space-y-2 text-sm text-slate-300">
            <li>
              <span className="text-slate-500">Service calls → </span>
              create, assign, and close field work
            </li>
            <li>
              <span className="text-slate-500">Preventive Maintenance → </span>
              meters, checklists, and PM history
            </li>
            <li>
              <span className="text-slate-500">Customers / Fleet → </span>
              accounts and machines
            </li>
            <li>
              <span className="text-slate-500">Inventory → </span>
              parts, stock, and purchase requests
            </li>
          </ul>
        </MatrixInfoPanel>
      </div>
    </MatrixShell>
  );
}
