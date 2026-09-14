"use client";

import { useEffect, useMemo, useState } from "react";
import ContextPanel from "../components/ContextPanel";
import MatrixShell from "../components/MatrixShell";
import FleetCopyCountsCard from "../components/maintenance/FleetCopyCountsCard";
import PmDashboardSummaryCard from "../components/maintenance/PmDashboardSummaryCard";
import {
  MatrixEmptyState,
  MatrixInfoPanel,
  MatrixPageHeader,
  MatrixSection,
  MatrixTableToolbar,
} from "../components/ui";
import DashboardActivityTable, {
  type ActivityRow,
} from "./DashboardActivityTable";
import DashboardOpsPanel from "./DashboardOpsPanel";
import ServiceHubWelcome from "./ServiceHubWelcome";
import { listServiceCalls, subscribeServiceCalls } from "@/lib/service-calls";

const SERVICE_HUB_DESCRIPTION =
  "Start a task, check work that needs attention, or review recent updates.";

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
 * Patch 52A.2 — Service Hub enterprise operations dashboard.
 * Existing widgets are preserved and restyled into the dashboard layout.
 */
export default function DashboardPage() {
  const [tick, setTick] = useState(0);
  const [activitySearch, setActivitySearch] = useState("");
  const [activityStatus, setActivityStatus] = useState("");

  useEffect(() => subscribeServiceCalls(() => setTick((t) => t + 1)), []);
  const recentActivity = useMemo(() => {
    void tick;
    return buildRecentActivity();
  }, [tick]);

  const filteredActivity = useMemo(() => {
    const q = activitySearch.trim().toLowerCase();
    return recentActivity.filter((row) => {
      if (activityStatus && row.status !== activityStatus) return false;
      if (!q) return true;
      return (
        row.customer.toLowerCase().includes(q) ||
        row.printer.toLowerCase().includes(q) ||
        row.issue.toLowerCase().includes(q) ||
        row.status.toLowerCase().includes(q)
      );
    });
  }, [recentActivity, activitySearch, activityStatus]);

  return (
    <MatrixShell title="Service Hub" activePath="/dashboard">
      <div className="matrix-page-stack matrix-hub">
      <MatrixPageHeader
        title="Your service workspace"
        breadcrumbs={["Matrix", "Workspace", "Service Hub"]}
        description={SERVICE_HUB_DESCRIPTION}
      />

      <ServiceHubWelcome />

      <nav aria-label="Service Hub sections" className="flex flex-wrap gap-2">
        {[
          ["#hub-work", "Tasks & daily work"],
          ["#hub-details", "Maintenance & fleet details"],
          ["#hub-activity", "Recent activity"],
        ].map(([href, label]) => (
          <a key={href} href={href}
            className="rounded-lg border border-[color:var(--matrix-border)] px-4 py-2 text-sm font-medium text-[color:var(--matrix-accent)] hover:bg-[color:var(--matrix-surface)] focus-visible:outline-2 focus-visible:outline-cyan-400">
            {label}
          </a>
        ))}
      </nav>

      <section id="hub-work" aria-label="Tasks and daily work" className="scroll-mt-20">
        <DashboardOpsPanel />
      </section>

      <details id="hub-details" className="scroll-mt-20 rounded-2xl border border-[color:var(--matrix-border)] bg-[color:var(--matrix-card-bg)]">
        <summary className="cursor-pointer rounded-2xl p-5 font-semibold focus-visible:outline-2 focus-visible:outline-cyan-400">
          Maintenance & fleet details
          <span className="mt-1 block text-sm font-normal text-[color:var(--matrix-muted)]">
            Expand for PM summaries, workflow context, and fleet copy counts.
          </span>
        </summary>
        <div className="matrix-page-stack p-4 pt-0 sm:p-5 sm:pt-0">
        <PmDashboardSummaryCard />
        <ContextPanel />
        <FleetCopyCountsCard />
        </div>
      </details>

      <div id="hub-activity" className="grid scroll-mt-20 gap-6 lg:grid-cols-3">
        <MatrixSection
          title="Recent Activity"
          subtitle="Newest service-call updates first (limited to 10)."
          className="lg:col-span-2"
        >
          <MatrixTableToolbar
            searchPlaceholder="Search recent activity…"
            searchValue={activitySearch}
            onSearchChange={setActivitySearch}
            statusFilter={activityStatus}
            onStatusFilterChange={setActivityStatus}
            statusOptions={[
              { value: "Open", label: "Open" },
              { value: "In Progress", label: "In Progress" },
              { value: "Waiting Parts", label: "Waiting Parts" },
              { value: "Completed", label: "Completed" },
            ]}
            onClearFilters={() => {
              setActivitySearch("");
              setActivityStatus("");
            }}
            compact
          />
          {filteredActivity.length === 0 ? (
            <MatrixEmptyState
              title="No matching activity"
              description="Try clearing filters, or create a new service call to get started."
              actionLabel="New Service Call"
              actionHref="/service-calls/new"
              className="py-10"
            />
          ) : (
            <div className="overflow-x-auto">
              <DashboardActivityTable data={filteredActivity} />
            </div>
          )}
        </MatrixSection>

        <MatrixInfoPanel
          title="Find your way around"
          subtitle="Use Find a page in the menu to jump to a tool, or browse the familiar sections below."
        >
          <ul className="space-y-2 text-sm text-[color:var(--foreground)]">
            <li>
              <span className="text-[color:var(--matrix-muted)]">Service Operations → </span>
              calls, dispatch, PM schedule, and field work
            </li>
            <li>
              <span className="text-[color:var(--matrix-muted)]">Machines → </span>
              fleet database, Digital Twin, meters, and history
            </li>
            <li>
              <span className="text-[color:var(--matrix-muted)]">Parts & Inventory → </span>
              stock, requests, PM kits, and ordering tools
            </li>
            <li>
              <span className="text-[color:var(--matrix-muted)]">Matrix AI → </span>
              Assist, operations, decisions, and automations
            </li>
          </ul>
        </MatrixInfoPanel>
      </div>
      </div>
    </MatrixShell>
  );
}
