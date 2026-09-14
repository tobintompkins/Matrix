"use client";

import { useMemo, type ReactNode } from "react";
import { useUser } from "@clerk/nextjs";
import {
  hasMatrixPermission,
  resolveMatrixRole,
} from "@/lib/auth/permissions";
import type { MatrixPermission } from "@/lib/auth/types";
import { QuickActionButton } from "@/app/components/dashboard";
import {
  IconClock,
  IconParts,
  IconPlus,
  IconWorkOrders,
} from "@/app/components/nav-icons";

type HeaderAction = {
  label: string;
  href: string;
  permission: MatrixPermission;
  primary?: boolean;
  icon: ReactNode;
};

const HEADER_ACTIONS: HeaderAction[] = [
  {
    label: "New Service Call",
    href: "/service-calls/new",
    permission: "CREATE_SERVICE_CALL",
    primary: true,
    icon: <IconPlus className="h-4 w-4" />,
  },
  {
    label: "Start Job Wizard",
    href: "/start-pm",
    permission: "MANAGE_PM",
    icon: <IconWorkOrders className="h-4 w-4" />,
  },
  {
    label: "Parts Request",
    href: "/inventory/purchase-requests",
    permission: "VIEW_INVENTORY",
    icon: <IconParts className="h-4 w-4" />,
  },
  {
    label: "View PM Schedule",
    href: "/maintenance/schedule",
    permission: "VIEW_FLEET_MAINTENANCE",
    icon: <IconClock className="h-4 w-4" />,
  },
];

/** Patch 52A.2 — permission-aware Service Hub header actions. */
export default function ServiceHubHeaderActions() {
  const { user } = useUser();
  const { role } = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );

  const actions = useMemo(
    () =>
      HEADER_ACTIONS.filter((action) =>
        hasMatrixPermission(role, action.permission),
      ),
    [role],
  );

  if (actions.length === 0) return null;

  return (
    <>
      {actions.map((action) => (
        <QuickActionButton
          key={action.href}
          label={action.label}
          href={action.href}
          icon={action.icon}
          variant={action.primary ? "primary" : "secondary"}
          className="w-auto min-w-[9.5rem]"
        />
      ))}
    </>
  );
}
