"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useUser } from "@clerk/nextjs";
import {
  hasMatrixPermission,
  resolveMatrixRole,
} from "@/lib/auth/permissions";
import type { MatrixPermission } from "@/lib/auth/types";
import { digitalTwinFleet } from "@/lib/digital-twin";
import { listPurchaseRequests } from "@/lib/inventory";
import { getPmDashboard } from "@/lib/pm-intelligence";
import {
  computeServiceCallMetrics,
  listServiceCalls,
} from "@/lib/service-calls";
import { MatrixButton, MatrixCard, MatrixStatCard } from "../components/ui";
import {
  IconCalls,
  IconCleaning,
  IconClock,
  IconInventory,
  IconMaintenance,
  IconMeter,
  IconParts,
  IconPlus,
  IconPrinter,
  IconTwin,
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

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: "New Service Call",
    href: "/service-calls/new",
    permission: "CREATE_SERVICE_CALL",
    icon: <IconPlus className="h-4 w-4" />,
  },
  {
    label: "Enter Meter Counts",
    href: "/maintenance/counts",
    permission: "VIEW_FLEET_MAINTENANCE",
    icon: <IconMeter className="h-4 w-4" />,
  },
  {
    label: "Order Parts",
    href: "/order-parts",
    permission: "CREATE_PARTS_ORDER",
    icon: <IconParts className="h-4 w-4" />,
  },
  {
    label: "Add Machine",
    href: "/register-printer",
    permission: "VIEW_DIGITAL_TWIN",
    icon: <IconPrinter className="h-4 w-4" />,
  },
  {
    label: "View PM Cleaning Counts",
    href: "/maintenance/cleanings",
    permission: "VIEW_FLEET_MAINTENANCE",
    icon: <IconCleaning className="h-4 w-4" />,
  },
];

function buildKpis(): KpiCard[] {
  const callMetrics = computeServiceCallMetrics(listServiceCalls());
  const machinesDown = digitalTwinFleet.filter(
    (m) => m.operational.status === "DOWN",
  ).length;
  const partsOnOrder = listPurchaseRequests().filter((pr) =>
    ["PENDING_APPROVAL", "APPROVED", "ORDERED"].includes(pr.status),
  ).length;
  const pm = getPmDashboard().metrics;
  const pendingPm = pm.pmsDueSoon + pm.pmsDueNow + pm.overduePms;

  return [
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
      id: "machines-down",
      label: "Machines Down",
      value: machinesDown,
      href: "/digital-twin",
      status:
        machinesDown === 0 ? "ok" : machinesDown >= 2 ? "attention" : "watch",
      trend: "Digital Twin operational status",
      icon: <IconTwin className="h-4 w-4" />,
    },
    {
      id: "parts-on-order",
      label: "Parts on Order",
      value: partsOnOrder,
      href: "/inventory/purchase-requests",
      status: partsOnOrder === 0 ? "ok" : "watch",
      trend: "Open purchase requests",
      icon: <IconInventory className="h-4 w-4" />,
    },
    {
      id: "pending-pm",
      label: "Pending Preventive Maintenance",
      value: pendingPm,
      href: "/maintenance",
      status:
        pm.overduePms > 0 ? "attention" : pendingPm > 0 ? "watch" : "ok",
      trend:
        pm.overduePms > 0
          ? `${pm.overduePms} overdue`
          : `${pm.pmsDueNow} due now`,
      icon: <IconMaintenance className="h-4 w-4" />,
    },
    {
      id: "avg-response",
      label: "Average Response Time",
      value: "—",
      href: "/dispatch",
      status: "unavailable",
      accent: "text-slate-500",
      trend: "Unavailable — not calculated yet",
      icon: <IconClock className="h-4 w-4" />,
    },
  ];
}

/** Live KPI row + permission-aware quick actions for the enterprise dashboard. */
export default function DashboardOpsPanel() {
  const { user } = useUser();
  const { role } = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );
  const [tick] = useState(0);

  const kpis = useMemo(() => {
    void tick;
    return buildKpis();
  }, [tick]);

  const actions = useMemo(
    () =>
      QUICK_ACTIONS.filter((action) =>
        hasMatrixPermission(role, action.permission),
      ),
    [role],
  );

  return (
    <div className="space-y-6">
      <section aria-label="Operations KPIs">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
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
        subtitle="Common field-service workflows."
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {actions.map((action) => (
            <MatrixButton
              key={action.href}
              href={action.href}
              variant="secondary"
              size="md"
              className="w-full justify-start gap-2 border-slate-700/80 bg-slate-950/40 text-left"
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
    </div>
  );
}
