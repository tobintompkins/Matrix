/**
 * Patch 51A.5 Part 3 Completion — Executive Briefing Center (period + filters).
 */

import { listServiceCalls } from "@/lib/service-calls";
import { isOpenServiceCallStatus } from "@/lib/service-calls/workflow";
import { listTechnicians } from "@/lib/service-dispatch";
import { listCustomers } from "@/lib/crm/repository";
import { getDashboardMetrics } from "@/lib/inventory";
import { getExecutiveCommandCenterSummary } from "./summary";
import { periodWindows } from "./reporting";
import type { ExecutiveReportPeriod } from "./reporting-types";
import {
  matchesText,
  type ExecutiveScopeFilters,
} from "./filters";
import type { ExecutiveBriefing } from "./types";

export type BriefingPeriod = "DAILY" | "WEEKLY" | "MONTHLY";

export type ExecutiveBriefingBundle = {
  period: BriefingPeriod;
  periodLabel: string;
  window: { start: string; end: string };
  previousWindow: { start: string; end: string };
  filters: ExecutiveScopeFilters;
  dataFreshness: string;
  briefing: ExecutiveBriefing;
  keyChanges: string[];
  sections: Array<{
    key: string;
    title: string;
    body: string;
    href?: string;
    items?: Array<{ label: string; value: string; href?: string }>;
  }>;
  risks: Array<{ title: string; detail: string; href?: string }>;
};

function inWindow(iso: string, start: Date, end: Date) {
  const t = new Date(iso).getTime();
  return t >= start.getTime() && t < end.getTime();
}

export function parseBriefingPeriod(raw: string | null | undefined): BriefingPeriod {
  const u = String(raw || "DAILY").toUpperCase();
  if (u === "WEEKLY" || u === "MONTHLY") return u;
  return "DAILY";
}

export async function buildExecutiveBriefingCenter(input?: {
  organizationId?: string;
  period?: string | null;
  filters?: ExecutiveScopeFilters;
}): Promise<ExecutiveBriefingBundle> {
  const period = parseBriefingPeriod(input?.period);
  const filters = input?.filters ?? {};
  const windows = periodWindows(period as ExecutiveReportPeriod);
  const summary = await getExecutiveCommandCenterSummary(input?.organizationId);
  const allCalls = listServiceCalls({ includeDeleted: false });

  const scoped = allCalls.filter((c) => {
    if (!matchesText(c.machine.customerName, filters.customer)) return false;
    if (
      !matchesText(
        c.machine.siteName || c.machine.machineLocation,
        filters.site,
      )
    )
      return false;
    if (!matchesText(c.assignment?.technician, filters.technician)) return false;
    if (
      !matchesText(c.machine.printerModel || c.machine.machineId, filters.model)
    )
      return false;
    if (filters.status && c.status !== filters.status) return false;
    return true;
  });

  const current = scoped.filter((c) =>
    inWindow(c.createdAt, windows.current.start, windows.current.end),
  );
  const previous = scoped.filter((c) =>
    inWindow(c.createdAt, windows.previous.start, windows.previous.end),
  );
  const open = scoped.filter((c) => isOpenServiceCallStatus(c.status));
  const aging = open.filter(
    (c) => Date.now() - new Date(c.createdAt).getTime() > 24 * 3_600_000,
  );
  const critical = open.filter(
    (c) =>
      c.priority === "CRITICAL" ||
      c.priority === "EMERGENCY" ||
      c.problem.machineCurrentlyDown,
  );

  const techs = listTechnicians();
  const customers = listCustomers(1, 50).items;
  const openByCustomer = new Map<string, number>();
  for (const c of open) {
    const name = c.machine.customerName || "Unknown";
    openByCustomer.set(name, (openByCustomer.get(name) ?? 0) + 1);
  }

  let invLow = 0;
  let invOut = 0;
  try {
    const m = getDashboardMetrics();
    invLow = m.lowStock ?? 0;
    invOut = m.outOfStock ?? 0;
  } catch {
    /* optional */
  }

  const briefing = summary.aiBriefing ?? {
    summary:
      "Executive briefing unavailable — refresh the Command Center overview first.",
    priorities: [],
    generatedAt: summary.generatedAt,
    provider: "matrix-local",
    model: "briefing-center-fallback",
    isSample: true,
    insufficientData: true,
    confidence: 0,
  };

  const keyChanges = [
    `Calls created: ${current.length} vs ${previous.length} prior (${current.length - previous.length >= 0 ? "+" : ""}${current.length - previous.length})`,
    `Open calls (filtered): ${open.length} (${aging.length} aging >24h)`,
    `Critical open (filtered): ${critical.length}`,
    summary.fleetHealth.score == null
      ? "Fleet health unavailable"
      : `Enterprise fleet health: ${summary.fleetHealth.score} (${summary.fleetHealth.status})`,
  ];

  const byMachine = new Map<string, number>();
  for (const c of scoped.filter(
    (x) => Date.now() - new Date(x.createdAt).getTime() < 90 * 86_400_000,
  )) {
    byMachine.set(
      c.machine.machineId,
      (byMachine.get(c.machine.machineId) ?? 0) + 1,
    );
  }
  const repeats = [...byMachine.entries()]
    .filter(([, n]) => n >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const sections: ExecutiveBriefingBundle["sections"] = [
    {
      key: "fleet",
      title: "Fleet health summary",
      body:
        summary.fleetHealth.score == null
          ? "Insufficient machine data for a fleet health score."
          : `Score ${summary.fleetHealth.score} (${summary.fleetHealth.status}) · ${summary.kpis.activeMachines} active machines.`,
      href: "/executive-command-center/scorecards",
    },
    {
      key: "pm",
      title: "PM compliance summary",
      body: `${summary.kpis.pmOverdue} PM overdue by meter · open service pressure ${open.length}.`,
      href: "/maintenance?filter=overdue",
    },
    {
      key: "service",
      title: "Open and aging service calls",
      body: `${open.length} open · ${aging.length} aging · ${critical.length} critical (filter-scoped).`,
      href: "/service-calls?status=OPEN",
      items: aging.slice(0, 5).map((c) => ({
        label: c.ticketNumber || c.id,
        value: c.machine.machineId,
        href: `/service-calls/${encodeURIComponent(c.id)}`,
      })),
    },
    {
      key: "repeats",
      title: "Repeat-failure summary",
      body:
        repeats.length === 0
          ? "No machines with ≥3 calls in 90 days in the current filter scope."
          : `${repeats.length} machine(s) show repeat service activity.`,
      href: "/service-calls",
      items: repeats.map(([id, n]) => ({
        label: id,
        value: `${n} calls / 90d`,
        href: `/ai-operations/predictive-maintenance/machines/${encodeURIComponent(id)}`,
      })),
    },
    {
      key: "customers",
      title: "Customer health summary",
      body: `${customers.length} customers loaded · ${openByCustomer.size} with open calls in scope.`,
      href: "/executive-command-center/customers",
      items: [...openByCustomer.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, n]) => ({
          label: name,
          value: `${n} open`,
          href: `/executive-command-center/customers?customer=${encodeURIComponent(name)}`,
        })),
    },
    {
      key: "technicians",
      title: "Technician workload and performance",
      body: `${techs.length} technician(s) on roster · coverage ${summary.kpis.technicianCoverageLabel}.`,
      href: "/executive-command-center/technicians",
    },
    {
      key: "inventory",
      title: "Inventory and parts risk",
      body: `Low stock: ${invLow} · Stockouts: ${invOut}.`,
      href: "/inventory",
    },
    {
      key: "predictive",
      title: "Predictive maintenance warnings",
      body: `${summary.kpis.machinesAtRisk} machine(s) at elevated predictive risk.`,
      href: "/executive-command-center/predictive",
    },
    {
      key: "actions",
      title: "AI-generated priorities and recommended actions",
      body: briefing.summary,
      href: "/executive-command-center/alerts",
      items: briefing.priorities.slice(0, 5).map((p) => ({
        label: p.title,
        value: p.reason,
        href: p.href ?? undefined,
      })),
    },
  ];

  const risks: ExecutiveBriefingBundle["risks"] = [
    ...(critical.length
      ? [
          {
            title: "Critical service exposure",
            detail: `${critical.length} critical/down calls open`,
            href: "/service-calls?status=OPEN&priority=CRITICAL",
          },
        ]
      : []),
    ...(invOut > 0
      ? [
          {
            title: "Parts stockouts",
            detail: `${invOut} out-of-stock part(s)`,
            href: "/inventory",
          },
        ]
      : []),
    ...(repeats[0]
      ? [
          {
            title: "Top repeat machine",
            detail: `${repeats[0][0]} · ${repeats[0][1]} calls / 90d`,
            href: `/ai-operations/predictive-maintenance/machines/${encodeURIComponent(repeats[0][0])}`,
          },
        ]
      : []),
  ];

  return {
    period,
    periodLabel: windows.label,
    window: {
      start: windows.current.start.toISOString(),
      end: windows.current.end.toISOString(),
    },
    previousWindow: {
      start: windows.previous.start.toISOString(),
      end: windows.previous.end.toISOString(),
    },
    filters,
    dataFreshness: summary.generatedAt || new Date().toISOString(),
    briefing,
    keyChanges,
    sections,
    risks,
  };
}
