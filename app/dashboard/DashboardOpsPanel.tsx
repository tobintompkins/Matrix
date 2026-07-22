"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import {
  hasMatrixPermission,
  resolveMatrixRole,
} from "@/lib/auth/permissions";
import type { MatrixPermission } from "@/lib/auth/types";
import { listCustomers } from "@/lib/crm";
import { digitalTwinFleet } from "@/lib/digital-twin";
import { getDashboardMetrics } from "@/lib/inventory";
import { getPmDashboard } from "@/lib/pm-intelligence";
import {
  computeServiceCallMetrics,
  listServiceCalls,
  subscribeServiceCalls,
} from "@/lib/service-calls";
import { getTicketMeta } from "@/lib/service-dispatch/repository";
import {
  isManagerOrAdminRole,
  isTechnicianRole,
} from "@/lib/service-hub/welcome";
import { MatrixButton, MatrixCard, MatrixStatCard } from "../components/ui";
import {
  IconCalls,
  IconCleaning,
  IconCustomers,
  IconInventory,
  IconMaintenance,
  IconMeter,
  IconParts,
  IconPlus,
  IconPrinter,
  IconTwin,
  IconAi,
} from "../components/nav-icons";

type KpiCard = {
  id: string;
  label: string;
  value: ReactNode;
  href?: string;
  status: "neutral" | "ok" | "watch" | "attention" | "unavailable";
  trend?: string;
  accent?: string;
  icon: ReactNode;
};

type QuickAction = {
  label: string;
  href: string;
  permission: MatrixPermission;
  icon: ReactNode;
};

type AttentionItem = {
  id: string;
  label: string;
  detail: string;
  href: string;
  severity: "attention" | "watch";
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: "Create Service Call",
    href: "/service-calls/new",
    permission: "CREATE_SERVICE_CALL",
    icon: <IconPlus className="h-4 w-4" />,
  },
  {
    label: "Record Meter",
    href: "/maintenance/counts",
    permission: "ENTER_COPY_COUNT",
    icon: <IconMeter className="h-4 w-4" />,
  },
  {
    label: "Schedule PM",
    href: "/maintenance/schedule",
    permission: "SCHEDULE_MAINTENANCE",
    icon: <IconMaintenance className="h-4 w-4" />,
  },
  {
    label: "Add Machine",
    href: "/register-printer",
    permission: "VIEW_DIGITAL_TWIN",
    icon: <IconPrinter className="h-4 w-4" />,
  },
  {
    label: "Add Customer",
    href: "/add-customer",
    permission: "VIEW_CUSTOMERS",
    icon: <IconCustomers className="h-4 w-4" />,
  },
  {
    label: "Order Parts",
    href: "/order-parts",
    permission: "CREATE_PARTS_ORDER",
    icon: <IconParts className="h-4 w-4" />,
  },
  {
    label: "View Inventory",
    href: "/inventory",
    permission: "VIEW_INVENTORY",
    icon: <IconInventory className="h-4 w-4" />,
  },
  {
    label: "View My Assignments",
    href: "/maintenance/technician",
    permission: "VIEW_FLEET_MAINTENANCE",
    icon: <IconCleaning className="h-4 w-4" />,
  },
  {
    label: "Matrix Assist",
    href: "/ai-technician",
    permission: "USE_MATRIX_ASSIST",
    icon: <IconAi className="h-4 w-4" />,
  },
];

function buildKpis(): KpiCard[] {
  const callMetrics = computeServiceCallMetrics(listServiceCalls());
  const machinesDown = digitalTwinFleet.filter(
    (m) => m.operational.status === "DOWN",
  ).length;
  const pm = getPmDashboard().metrics;
  const inventory = getDashboardMetrics();
  const customers = listCustomers(1, 1);
  const machineCount = digitalTwinFleet.length;

  const cards: KpiCard[] = [
    {
      id: "open-calls",
      label: "Open Service Calls",
      value: callMetrics.totalOpen,
      href: "/service-calls",
      status:
        callMetrics.totalOpen === 0
          ? "ok"
          : callMetrics.overdue > 0
            ? "attention"
            : "watch",
      trend:
        callMetrics.overdue > 0
          ? `${callMetrics.overdue} overdue`
          : `${callMetrics.unassigned} unassigned`,
      icon: <IconCalls className="h-4 w-4" />,
    },
    {
      id: "pm-due-soon",
      label: "PM Due Soon",
      value: pm.pmsDueSoon,
      href: "/maintenance",
      status: pm.pmsDueSoon > 0 ? "watch" : "ok",
      trend: "Impression-meter PM window",
      icon: <IconMaintenance className="h-4 w-4" />,
    },
    {
      id: "pm-overdue",
      label: "Overdue PM",
      value: pm.overduePms,
      href: "/maintenance",
      status: pm.overduePms > 0 ? "attention" : "ok",
      trend: pm.overduePms > 0 ? "Needs scheduling" : "None overdue",
      icon: <IconCleaning className="h-4 w-4" />,
    },
    {
      id: "machines-attention",
      label: "Machines Requiring Attention",
      value: machinesDown,
      href: "/digital-twin",
      status:
        machinesDown === 0 ? "ok" : machinesDown >= 2 ? "attention" : "watch",
      trend: "Digital Twin DOWN status",
      icon: <IconTwin className="h-4 w-4" />,
    },
    {
      id: "low-stock",
      label: "Low-Stock Parts",
      value: inventory.lowStock,
      href: "/inventory",
      status:
        inventory.lowStock === 0
          ? "ok"
          : inventory.outOfStock > 0
            ? "attention"
            : "watch",
      trend:
        inventory.outOfStock > 0
          ? `${inventory.outOfStock} out of stock`
          : "Catalog balances",
      icon: <IconInventory className="h-4 w-4" />,
    },
    {
      id: "customers",
      label: "Customers",
      value: customers.total,
      href: "/customers",
      status: "neutral",
      trend: "CRM accounts",
      icon: <IconCustomers className="h-4 w-4" />,
    },
    {
      id: "machines",
      label: "Machines",
      value: machineCount,
      href: "/fleet",
      status: "neutral",
      trend: "Active fleet",
      icon: <IconPrinter className="h-4 w-4" />,
    },
  ];

  return cards;
}

function buildAttentionItems(): AttentionItem[] {
  const callMetrics = computeServiceCallMetrics(listServiceCalls());
  const calls = listServiceCalls();
  const pm = getPmDashboard().metrics;
  const inventory = getDashboardMetrics();
  const items: AttentionItem[] = [];

  if (pm.overduePms > 0) {
    items.push({
      id: "overdue-pm",
      label: "Overdue preventive maintenance",
      detail: `${pm.overduePms} machine${pm.overduePms === 1 ? "" : "s"} past PM interval`,
      href: "/maintenance",
      severity: "attention",
    });
  }
  if (callMetrics.unassigned > 0) {
    items.push({
      id: "unassigned-calls",
      label: "Unassigned service calls",
      detail: `${callMetrics.unassigned} call${callMetrics.unassigned === 1 ? "" : "s"} waiting for assignment`,
      href: "/service-calls",
      severity: "attention",
    });
  }
  const critical = calls.filter(
    (c) =>
      !["RESOLVED", "CLOSED", "CANCELLED"].includes(c.status) &&
      (c.priority === "CRITICAL" || c.priority === "EMERGENCY"),
  ).length;
  if (critical > 0) {
    items.push({
      id: "critical-calls",
      label: "Critical-priority service calls",
      detail: `${critical} open critical / emergency call${critical === 1 ? "" : "s"}`,
      href: "/service-calls",
      severity: "attention",
    });
  }
  const portalSubmitted = calls.filter((c) => {
    return (
      getTicketMeta(c.id)?.source === "CUSTOMER_PORTAL" &&
      !["RESOLVED", "CLOSED", "CANCELLED"].includes(c.status)
    );
  }).length;
  if (portalSubmitted > 0) {
    items.push({
      id: "portal-submitted",
      label: "Portal-submitted service requests",
      detail: `${portalSubmitted} open request${portalSubmitted === 1 ? "" : "s"} from Customer Portal`,
      href: "/service-calls",
      severity: "watch",
    });
  }
  if (inventory.lowStock > 0) {
    items.push({
      id: "low-stock",
      label: "Low-stock parts",
      detail: `${inventory.lowStock} part${inventory.lowStock === 1 ? "" : "s"} below reorder level`,
      href: "/inventory",
      severity: inventory.outOfStock > 0 ? "attention" : "watch",
    });
  }

  return items;
}

function buildMyWork(displayName: string) {
  const name = displayName.trim().toLowerCase();
  const openStatuses = new Set([
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
  ]);
  const assignedCalls = listServiceCalls()
    .filter(
      (c) =>
        openStatuses.has(c.status) &&
        (c.assignment.technician ?? "").toLowerCase().includes(name),
    )
    .slice(0, 8);

  return assignedCalls.map((c) => ({
    id: c.id,
    title: c.problem.issueTitle || c.workOrderNumber,
    detail: `${c.machine.customerName} · ${c.priority}`,
    href: `/service-calls/${c.id}`,
    status: c.status,
  }));
}

/** Live KPI row + permission-aware quick actions for the Service Hub. */
export default function DashboardOpsPanel() {
  const { user } = useUser();
  const { role } = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );
  const [tick, setTick] = useState(0);
  const displayName =
    user?.fullName ??
    user?.username ??
    user?.primaryEmailAddress?.emailAddress ??
    "";

  useEffect(() => subscribeServiceCalls(() => setTick((t) => t + 1)), []);

  const kpis = useMemo(() => {
    void tick;
    return buildKpis().filter((kpi) => {
      if (kpi.id === "low-stock") {
        return hasMatrixPermission(role, "VIEW_INVENTORY");
      }
      return true;
    });
  }, [tick, role]);

  const actions = useMemo(
    () =>
      QUICK_ACTIONS.filter((action) =>
        hasMatrixPermission(role, action.permission),
      ),
    [role],
  );

  const attention = useMemo(() => {
    void tick;
    return buildAttentionItems().filter((item) => {
      if (item.id === "low-stock") {
        return hasMatrixPermission(role, "VIEW_INVENTORY");
      }
      if (item.id === "overdue-pm") {
        return hasMatrixPermission(role, "VIEW_FLEET_MAINTENANCE");
      }
      if (item.id.endsWith("calls") || item.id.includes("calls")) {
        return hasMatrixPermission(role, "VIEW_SERVICE_CALLS");
      }
      return true;
    });
  }, [tick, role]);

  const myWork = useMemo(() => {
    void tick;
    if (!isTechnicianRole(role) || !displayName) return [];
    return buildMyWork(displayName);
  }, [tick, role, displayName]);

  const callMetrics = useMemo(() => {
    void tick;
    return computeServiceCallMetrics(listServiceCalls());
  }, [tick]);

  const showManagerOverview = isManagerOrAdminRole(role);

  return (
    <div className="space-y-6">
      <section aria-label="Service Hub summary">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-300">Summary</h2>
          <MatrixButton
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setTick((t) => t + 1)}
            aria-label="Refresh Service Hub metrics"
          >
            Refresh
          </MatrixButton>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((kpi) => (
            <MatrixStatCard
              key={kpi.id}
              label={kpi.label}
              value={kpi.value}
              href={kpi.href}
              status={kpi.status}
              trend={kpi.trend}
              accent={kpi.accent}
              icon={kpi.icon}
              className="p-4"
            />
          ))}
        </div>
      </section>

      <MatrixCard
        title="Quick Actions"
        subtitle="Permission-aware shortcuts into existing workflows."
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {actions.map((action) => (
            <MatrixButton
              key={action.href}
              href={action.href}
              variant="secondary"
              size="md"
              className="min-h-11 w-full justify-start gap-2 border-slate-700/80 bg-slate-950/40 text-left"
            >
              <span className="text-slate-400" aria-hidden>
                {action.icon}
              </span>
              {action.label}
            </MatrixButton>
          ))}
          {actions.length === 0 && (
            <p className="col-span-full text-sm text-slate-500">
              No quick actions available for your role.
            </p>
          )}
        </div>
      </MatrixCard>

      {isTechnicianRole(role) ? (
        <MatrixCard
          title="My Work"
          subtitle="Assigned open service calls for you."
          actions={
            <Link
              href="/maintenance/technician"
              className="text-sm font-medium text-cyan-400 hover:underline"
            >
              Technician PM view
            </Link>
          }
        >
          {myWork.length === 0 ? (
            <p className="text-sm text-slate-500">
              You do not have any assigned work right now.
            </p>
          ) : (
            <ul className="divide-y divide-slate-800/80">
              {myWork.map((item) => (
                <li key={item.id} className="py-2.5 first:pt-0 last:pb-0">
                  <Link
                    href={item.href}
                    className="block rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
                  >
                    <p className="truncate text-sm font-medium text-slate-100">
                      {item.title}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {item.detail} · {item.status}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </MatrixCard>
      ) : null}

      {showManagerOverview ? (
        <MatrixCard
          title="Operations Overview"
          subtitle="Team-level service and maintenance snapshot."
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <MatrixStatCard
              label="Open calls"
              value={callMetrics.totalOpen}
              href="/service-calls"
              status={callMetrics.totalOpen > 0 ? "watch" : "ok"}
              className="p-4"
            />
            <MatrixStatCard
              label="Unassigned"
              value={callMetrics.unassigned}
              href="/service-calls"
              status={callMetrics.unassigned > 0 ? "attention" : "ok"}
              className="p-4"
            />
            <MatrixStatCard
              label="Overdue calls"
              value={callMetrics.overdue}
              href="/dispatch"
              status={callMetrics.overdue > 0 ? "attention" : "ok"}
              className="p-4"
            />
          </div>
        </MatrixCard>
      ) : null}

      <MatrixCard
        title="Attention Required"
        subtitle="Items calculated from live service, PM, and inventory records."
      >
        {attention.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nothing currently requires attention.
          </p>
        ) : (
          <ul className="space-y-2">
            {attention.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm transition hover:bg-slate-900/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 ${
                    item.severity === "attention"
                      ? "border-rose-500/30 bg-rose-500/5 text-rose-100"
                      : "border-amber-500/30 bg-amber-500/5 text-amber-100"
                  }`}
                >
                  <span
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-current"
                    aria-hidden
                  />
                  <span>
                    <span className="font-medium">{item.label}</span>
                    <span className="mt-0.5 block text-xs opacity-80">
                      {item.detail}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </MatrixCard>
    </div>
  );
}
