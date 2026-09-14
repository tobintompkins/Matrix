"use client";

import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
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
import {
  AttentionItem,
  DashboardKpiCard,
  DashboardKpiCardRow,
  DashboardSectionCard,
  QuickActionButton,
  type AttentionSeverity,
} from "@/app/components/dashboard";
import { MatrixButton, MatrixEmptyState } from "@/app/components/ui";
import {
  IconAi,
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
  IconWorkOrders,
} from "@/app/components/nav-icons";

type KpiCard = {
  id: string;
  label: string;
  value: ReactNode;
  href?: string;
  status: "neutral" | "ok" | "watch" | "attention" | "unavailable";
  trend?: string;
  icon: ReactNode;
};

type QuickAction = {
  label: string;
  href: string;
  permission: MatrixPermission;
  icon: ReactNode;
  primary?: boolean;
  description?: string;
};

type AttentionRow = {
  id: string;
  title: string;
  description: string;
  href: string;
  severity: AttentionSeverity;
  dueLabel?: string;
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: "New Service Call",
    description: "Record a customer issue and begin tracking the repair.",
    href: "/service-calls/new",
    permission: "CREATE_SERVICE_CALL",
    icon: <IconPlus className="h-4 w-4" />,
    primary: true,
  },
  {
    label: "Create PM",
    description: "Plan preventive maintenance for a machine.",
    href: "/maintenance/schedule",
    permission: "SCHEDULE_MAINTENANCE",
    icon: <IconMaintenance className="h-4 w-4" />,
  },
  {
    label: "Start Job Wizard",
    description: "Follow the guided steps to prepare a job.",
    href: "/start-pm",
    permission: "MANAGE_PM",
    icon: <IconWorkOrders className="h-4 w-4" />,
  },
  {
    label: "Request Part",
    description: "Review purchase requests and request what you need.",
    href: "/inventory/purchase-requests",
    permission: "VIEW_INVENTORY",
    icon: <IconParts className="h-4 w-4" />,
  },
  {
    label: "Customer Lookup",
    description: "Find contact details, locations, and customer records.",
    href: "/customers",
    permission: "VIEW_CUSTOMERS",
    icon: <IconCustomers className="h-4 w-4" />,
  },
  {
    label: "Machine Lookup",
    description: "Find a printer and open its equipment record.",
    href: "/fleet",
    permission: "VIEW_DIGITAL_TWIN",
    icon: <IconPrinter className="h-4 w-4" />,
  },
  {
    label: "Open AI Technician",
    description: "Get help with troubleshooting and service questions.",
    href: "/ai-technician",
    permission: "USE_MATRIX_ASSIST",
    icon: <IconAi className="h-4 w-4" />,
  },
  {
    label: "Record Meter",
    description: "Enter a machine copy count.",
    href: "/maintenance/counts",
    permission: "ENTER_COPY_COUNT",
    icon: <IconMeter className="h-4 w-4" />,
  },
  {
    label: "Order Parts",
    description: "Build an order for the parts a job needs.",
    href: "/order-parts",
    permission: "CREATE_PARTS_ORDER",
    icon: <IconParts className="h-4 w-4" />,
  },
  {
    label: "My Assignments",
    description: "Open your technician maintenance workspace.",
    href: "/maintenance/technician",
    permission: "VIEW_FLEET_MAINTENANCE",
    icon: <IconCleaning className="h-4 w-4" />,
  },
];

function startOfTodayMs() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function buildPrimaryKpis(): KpiCard[] {
  const calls = listServiceCalls();
  const callMetrics = computeServiceCallMetrics(calls);
  const todayStart = startOfTodayMs();
  const todaysJobs = calls.filter((c) => {
    if (c.isDraft) return false;
    const created = new Date(c.createdAt).getTime();
    const updated = new Date(c.updatedAt || c.createdAt).getTime();
    return created >= todayStart || updated >= todayStart;
  }).length;
  const pm = getPmDashboard().metrics;
  const inventory = getDashboardMetrics();
  const partsWaiting =
    inventory.lowStock +
    calls.filter((c) => c.status === "WAITING_FOR_PARTS").length;

  return [
    {
      id: "todays-jobs",
      label: "Calls Updated Today",
      value: todaysJobs,
      href: "/service-calls",
      status: todaysJobs > 0 ? "watch" : "ok",
      trend: "Created or updated today",
      icon: <IconCalls className="h-4 w-4" />,
    },
    {
      id: "open-calls",
      label: "Open Calls",
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
      id: "pm-due",
      label: "PM Due",
      value: pm.pmsDueSoon + pm.overduePms,
      href: "/maintenance",
      status:
        pm.overduePms > 0 ? "attention" : pm.pmsDueSoon > 0 ? "watch" : "ok",
      trend:
        pm.overduePms > 0
          ? `${pm.overduePms} overdue`
          : "Impression-meter PM window",
      icon: <IconMaintenance className="h-4 w-4" />,
    },
    {
      id: "parts-waiting",
      label: "Parts Waiting",
      value: partsWaiting,
      href: "/inventory",
      status:
        partsWaiting === 0
          ? "ok"
          : inventory.outOfStock > 0
            ? "attention"
            : "watch",
      trend:
        inventory.outOfStock > 0
          ? `${inventory.outOfStock} out of stock`
          : "Low stock + waiting-for-parts calls",
      icon: <IconInventory className="h-4 w-4" />,
    },
  ];
}

function buildSecondaryKpis(): KpiCard[] {
  const machinesDown = digitalTwinFleet.filter(
    (m) => m.operational.status === "DOWN",
  ).length;
  const customers = listCustomers(1, 1);
  const machineCount = digitalTwinFleet.length;

  return [
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
}

function buildAttentionItems(): AttentionRow[] {
  const callMetrics = computeServiceCallMetrics(listServiceCalls());
  const calls = listServiceCalls();
  const pm = getPmDashboard().metrics;
  const inventory = getDashboardMetrics();
  const items: AttentionRow[] = [];

  if (pm.overduePms > 0) {
    items.push({
      id: "overdue-pm",
      title: "Overdue preventive maintenance",
      description: `${pm.overduePms} machine${pm.overduePms === 1 ? "" : "s"} past PM interval`,
      href: "/maintenance",
      severity: "critical",
      dueLabel: "PM overdue",
    });
  }
  if (callMetrics.unassigned > 0) {
    items.push({
      id: "unassigned-calls",
      title: "Unassigned service calls",
      description: `${callMetrics.unassigned} call${callMetrics.unassigned === 1 ? "" : "s"} waiting for assignment`,
      href: "/service-calls",
      severity: "critical",
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
      title: "Critical-priority service calls",
      description: `${critical} open critical / emergency call${critical === 1 ? "" : "s"}`,
      href: "/service-calls",
      severity: "critical",
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
      title: "Portal-submitted service requests",
      description: `${portalSubmitted} open request${portalSubmitted === 1 ? "" : "s"} from Customer Portal`,
      href: "/service-calls",
      severity: "warning",
    });
  }
  if (inventory.lowStock > 0) {
    items.push({
      id: "low-stock",
      title: "Low-stock parts",
      description: `${inventory.lowStock} part${inventory.lowStock === 1 ? "" : "s"} below reorder level`,
      href: "/inventory",
      severity: inventory.outOfStock > 0 ? "critical" : "warning",
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
  return listServiceCalls()
    .filter(
      (c) =>
        openStatuses.has(c.status) &&
        (c.assignment.technician ?? "").toLowerCase().includes(name),
    )
    .slice(0, 8)
    .map((c) => ({
      id: c.id,
      title: c.problem.issueTitle || c.workOrderNumber,
      detail: `${c.machine.customerName} · ${c.priority}`,
      href: `/service-calls/${c.id}`,
      status: c.status,
    }));
}

function buildTodaysSchedule() {
  const todayStart = startOfTodayMs();
  return listServiceCalls()
    .filter((c) => {
      if (c.isDraft) return false;
      if (["RESOLVED", "CLOSED", "CANCELLED"].includes(c.status)) return false;
      const created = new Date(c.createdAt).getTime();
      const updated = new Date(c.updatedAt || c.createdAt).getTime();
      return created >= todayStart || updated >= todayStart;
    })
    .slice(0, 8)
    .map((c) => ({
      id: c.id,
      title: c.problem.issueTitle || c.workOrderNumber,
      detail: `${c.machine.customerName} · ${c.status}`,
      href: `/service-calls/${c.id}`,
    }));
}

function buildPmDueSoon() {
  const rows = getPmDashboard().rows ?? [];
  return rows
    .filter((row) => {
      const status = String(row.pmStatus ?? "");
      return (
        status === "Due Soon" ||
        status === "Due" ||
        status === "Overdue" ||
        status === "Critical" ||
        status === "Severely Overdue"
      );
    })
    .slice(0, 8)
    .map((row) => ({
      id: row.printerId,
      title: row.machineName || row.assetNumber || row.printerId,
      detail: `${row.customerName} · ${row.pmStatus}`,
      href: "/maintenance",
      dueLabel: String(row.pmStatus),
    }));
}

function buildFleetAlerts() {
  return digitalTwinFleet
    .filter(
      (m) =>
        m.operational.status === "DOWN" ||
        m.operational.status === "DEGRADED" ||
        m.operational.status === "SERVICE_REQUIRED",
    )
    .slice(0, 8)
    .map((m) => ({
      id: m.identity.machineId,
      title: m.identity.nickname || m.identity.assetTag,
      description: `${m.operational.status} · ${m.location.customerName}`,
      href: `/digital-twin/${m.identity.machineId}`,
      severity:
        m.operational.status === "DOWN"
          ? ("critical" as const)
          : ("warning" as const),
    }));
}

const subscribeHydration = () => () => {};

/** Service Hub tasks and operational overview. */
export default function DashboardOpsPanel() {
  const { user } = useUser();
  const { role } = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );
  const [tick, setTick] = useState(0);
  const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
  const displayName =
    user?.fullName ??
    user?.username ??
    user?.primaryEmailAddress?.emailAddress ??
    "";

  useEffect(() => {
    return subscribeServiceCalls(() => setTick((t) => t + 1));
  }, []);

  const primaryKpis = useMemo(() => {
    void tick;
    return buildPrimaryKpis().filter((kpi) => {
      if (kpi.id === "parts-waiting") {
        return hasMatrixPermission(role, "VIEW_INVENTORY");
      }
      return true;
    });
  }, [tick, role]);

  const secondaryKpis = useMemo(() => {
    void tick;
    return buildSecondaryKpis();
  }, [tick]);

  const quickActions = useMemo(
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
      if (item.id.includes("calls")) {
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

  const todaysSchedule = useMemo(() => {
    void tick;
    return buildTodaysSchedule();
  }, [tick]);

  const pmDueSoon = useMemo(() => {
    void tick;
    return buildPmDueSoon();
  }, [tick]);

  const fleetAlerts = useMemo(() => {
    void tick;
    return buildFleetAlerts();
  }, [tick]);

  const callMetrics = useMemo(() => {
    void tick;
    return computeServiceCallMetrics(listServiceCalls());
  }, [tick]);

  const showManagerOverview = isManagerOrAdminRole(role);
  const loading = !hydrated;

  return (
    <div className="space-y-6">
      <DashboardSectionCard
        title="What would you like to do?"
        subtitle="Choose what you need to do. Your tools and records are one step away."
        loading={loading}
      >
        {quickActions.length === 0 ? (
          <MatrixEmptyState
            title="No quick actions available"
            description="Your role does not currently include Service Hub shortcuts."
            className="py-8"
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {quickActions.map((action) => (
              <QuickActionButton
                key={action.href}
                label={action.label}
                description={action.description}
                href={action.href}
                icon={action.icon}
                variant={action.primary ? "primary" : "secondary"}
              />
            ))}
          </div>
        )}
      </DashboardSectionCard>

      <section aria-label="Service Hub KPI summary">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-300">
            Operational summary
          </h2>
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
        <DashboardKpiCardRow>
          {(loading
            ? Array.from({ length: 4 }, (_, i) => ({
                id: `skeleton-${i}`,
                loading: true as const,
              }))
            : primaryKpis
          ).map((kpi) =>
            "loading" in kpi && kpi.loading ? (
              <DashboardKpiCard key={kpi.id} label="" value="" loading />
            ) : (
              <DashboardKpiCard
                key={(kpi as KpiCard).id}
                label={(kpi as KpiCard).label}
                value={(kpi as KpiCard).value}
                href={(kpi as KpiCard).href}
                status={(kpi as KpiCard).status}
                trend={(kpi as KpiCard).trend}
                icon={(kpi as KpiCard).icon}
              />
            ),
          )}
        </DashboardKpiCardRow>
        {!loading && secondaryKpis.length > 0 && (
          <details className="matrix-disclosure mt-4">
            <summary>More fleet and customer metrics</summary>
            <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {secondaryKpis.map((kpi) => (
              <DashboardKpiCard
                key={kpi.id}
                label={kpi.label}
                value={kpi.value}
                href={kpi.href}
                status={kpi.status}
                trend={kpi.trend}
                icon={kpi.icon}
              />
            ))}
            </div>
          </details>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <DashboardSectionCard
            title="Today's Service Activity"
            subtitle="Open service work created or updated today."
            loading={loading}
            actions={
              <Link
                href="/service-calls"
                className="text-sm font-medium text-cyan-400 hover:underline"
              >
                View all
              </Link>
            }
          >
            {todaysSchedule.length === 0 ? (
              <MatrixEmptyState
                title="No service activity today"
                description="New or updated open service calls will appear here."
                className="py-8"
              />
            ) : (
              <ul className="divide-y divide-slate-800/80">
                {todaysSchedule.map((item) => (
                  <li key={item.id} className="py-2.5 first:pt-0 last:pb-0">
                    <Link
                      href={item.href}
                      className="block rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
                    >
                      <p className="truncate text-sm font-medium text-slate-100">
                        {item.title}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {item.detail}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </DashboardSectionCard>

          <details className="matrix-disclosure">
            <summary>
              More schedule and team details
              <span className="mt-1 block text-sm font-normal text-[color:var(--matrix-muted)]">
                PM due soon, assigned work, and team snapshot.
              </span>
            </summary>
            <div className="space-y-6 p-4 pt-0">
          <DashboardSectionCard
            title="PM Due Soon"
            subtitle="Preventive maintenance approaching or overdue."
            loading={loading}
            actions={
              <Link
                href="/maintenance/schedule"
                className="text-sm font-medium text-cyan-400 hover:underline"
              >
                PM Schedule
              </Link>
            }
          >
            {pmDueSoon.length === 0 ? (
              <MatrixEmptyState
                title="No PM work due soon"
                description="Machines nearing their PM window will show up here."
                className="py-8"
              />
            ) : (
              <ul className="space-y-2">
                {pmDueSoon.map((item) => (
                  <li key={item.id}>
                    <AttentionItem
                      title={item.title}
                      description={item.detail}
                      href={item.href}
                      severity="warning"
                      statusLabel="PM due"
                      dueLabel={item.dueLabel}
                      actionLabel="Open maintenance"
                    />
                  </li>
                ))}
              </ul>
            )}
          </DashboardSectionCard>

          {isTechnicianRole(role) ? (
            <DashboardSectionCard
              title="My Work"
              subtitle="Assigned open service calls for you."
              loading={loading}
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
                <MatrixEmptyState
                  title="No assigned work right now"
                  description="New assignments will appear here when dispatch routes work to you."
                  className="py-8"
                />
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
            </DashboardSectionCard>
          ) : null}

          {showManagerOverview ? (
            <DashboardSectionCard
              title="Operations Overview"
              subtitle="Team-level service and maintenance snapshot."
              loading={loading}
            >
              <DashboardKpiCardRow className="xl:grid-cols-3">
                <DashboardKpiCard
                  label="Open calls"
                  value={callMetrics.totalOpen}
                  href="/service-calls"
                  status={callMetrics.totalOpen > 0 ? "watch" : "ok"}
                />
                <DashboardKpiCard
                  label="Unassigned"
                  value={callMetrics.unassigned}
                  href="/service-calls"
                  status={callMetrics.unassigned > 0 ? "attention" : "ok"}
                />
                <DashboardKpiCard
                  label="Overdue calls"
                  value={callMetrics.overdue}
                  href="/dispatch"
                  status={callMetrics.overdue > 0 ? "attention" : "ok"}
                />
              </DashboardKpiCardRow>
            </DashboardSectionCard>
          ) : null}
            </div>
          </details>
        </div>

        <div className="space-y-6 lg:col-span-1">
          <DashboardSectionCard
            title="Urgent Machines / Fleet Alerts"
            subtitle="Machines currently down, degraded, or needing service."
            loading={loading}
            actions={
              <Link
                href="/digital-twin"
                className="text-sm font-medium text-cyan-400 hover:underline"
              >
                Digital Twin
              </Link>
            }
          >
            {fleetAlerts.length === 0 ? (
              <MatrixEmptyState
                title="No urgent fleet alerts"
                description="Fleet health looks clear based on current Digital Twin status."
                className="py-8"
              />
            ) : (
              <ul className="space-y-2">
                {fleetAlerts.map((item) => (
                  <li key={item.id}>
                    <AttentionItem
                      title={item.title}
                      description={item.description}
                      href={item.href}
                      severity={item.severity}
                      actionLabel="Open twin"
                    />
                  </li>
                ))}
              </ul>
            )}
          </DashboardSectionCard>

          <DashboardSectionCard
            title="Parts & Approvals Attention"
            subtitle="Items calculated from live service, PM, and inventory records."
            loading={loading}
          >
            {attention.length === 0 ? (
              <MatrixEmptyState
                title="No parts requests waiting"
                description="Nothing currently requires parts or approval attention."
                className="py-8"
              />
            ) : (
              <ul className="space-y-2">
                {attention.map((item) => (
                  <li key={item.id}>
                    <AttentionItem
                      title={item.title}
                      description={item.description}
                      href={item.href}
                      severity={item.severity}
                      dueLabel={item.dueLabel}
                      actionLabel="Review"
                    />
                  </li>
                ))}
              </ul>
            )}
          </DashboardSectionCard>
        </div>
      </div>
    </div>
  );
}
