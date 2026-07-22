"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useUser } from "@clerk/nextjs";
import {
  hasMatrixPermission,
  resolveMatrixRole,
} from "@/lib/auth/permissions";
import type { MatrixPermission } from "@/lib/auth/types";

type NavItem = {
  href: string;
  label: string;
  permission: MatrixPermission;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const ADMIN_NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/admin", label: "Overview", permission: "VIEW_ADMIN_OVERVIEW" },
    ],
  },
  {
    label: "Access",
    items: [
      { href: "/admin/users", label: "Users & Access", permission: "MANAGE_USERS" },
      {
        href: "/admin/roles",
        label: "Roles & Permissions",
        permission: "MANAGE_ROLES",
      },
      {
        href: "/admin/security",
        label: "Security",
        permission: "VIEW_SECURITY_CENTER",
      },
    ],
  },
  {
    label: "Data",
    items: [
      {
        href: "/admin/data",
        label: "Data Administration",
        permission: "VIEW_DATA_ADMINISTRATION",
      },
      {
        href: "/admin/service-calls",
        label: "Service Calls",
        permission: "ADMIN_EDIT_SERVICE_CALL",
      },
      {
        href: "/admin/customers",
        label: "Customers",
        permission: "ADMIN_EDIT_CUSTOMER",
      },
      {
        href: "/admin/machines",
        label: "Machines",
        permission: "ADMIN_EDIT_MACHINE",
      },
      {
        href: "/admin/preventive-maintenance",
        label: "Preventive Maintenance",
        permission: "ADMIN_EDIT_PM",
      },
      { href: "/admin/meters", label: "Meters", permission: "ADMIN_EDIT_METER" },
      {
        href: "/admin/inventory",
        label: "Parts & Inventory",
        permission: "ADMIN_EDIT_PART",
      },
      {
        href: "/admin/archived-records",
        label: "Archived Records",
        permission: "VIEW_ARCHIVED_RECORDS",
      },
      {
        href: "/admin/deleted-records",
        label: "Deleted Records",
        permission: "VIEW_DELETED_RECORDS",
      },
      {
        href: "/admin/managed-content",
        label: "Managed Content",
        permission: "MANAGE_ADMIN_CONTENT",
      },
    ],
  },
  {
    label: "Configuration",
    items: [
      {
        href: "/admin/configuration",
        label: "System Configuration",
        permission: "MANAGE_SYSTEM_CONFIGURATION",
      },
      {
        href: "/admin/organization",
        label: "Organization Settings",
        permission: "MANAGE_ORGANIZATION_SETTINGS",
      },
      {
        href: "/admin/features",
        label: "Feature Controls",
        permission: "MANAGE_FEATURE_CONTROLS",
      },
      {
        href: "/admin/notifications",
        label: "Notifications",
        permission: "MANAGE_NOTIFICATION_SETTINGS",
      },
      {
        href: "/admin/announcements",
        label: "Announcements",
        permission: "MANAGE_ANNOUNCEMENTS",
      },
      {
        href: "/admin/matrix-assist",
        label: "Matrix Assist",
        permission: "MANAGE_MATRIX_ASSIST_SETTINGS",
      },
      {
        href: "/admin/portal",
        label: "Customer Portal",
        permission: "ADMINISTER_CUSTOMER_PORTAL",
      },
    ],
  },
  {
    label: "Insights",
    items: [
      {
        href: "/admin/executive",
        label: "Executive Dashboard",
        permission: "VIEW_EXECUTIVE_ADMIN_DASHBOARD",
      },
      {
        href: "/admin/approvals",
        label: "Approval Center",
        permission: "VIEW_APPROVAL_CENTER",
      },
      {
        href: "/admin/organization-health",
        label: "Organization Health",
        permission: "VIEW_ORGANIZATION_HEALTH",
      },
      {
        href: "/admin/data-quality",
        label: "Data Quality Center",
        permission: "VIEW_DATA_QUALITY_CENTER",
      },
      {
        href: "/admin/system-logs",
        label: "System Logs",
        permission: "VIEW_SYSTEM_LOGS",
      },
      {
        href: "/admin/role-simulator",
        label: "Role Simulator",
        permission: "VIEW_ROLE_SIMULATOR",
      },
      {
        href: "/admin/reports",
        label: "Admin Reports",
        permission: "VIEW_ADMIN_REPORTS",
      },
      {
        href: "/admin/usage",
        label: "Usage & Adoption",
        permission: "VIEW_USAGE_ANALYTICS",
      },
      {
        href: "/admin/audit",
        label: "Audit History",
        permission: "VIEW_AUDIT_HISTORY",
      },
    ],
  },
  {
    label: "System",
    items: [
      {
        href: "/admin/system-health",
        label: "System Health",
        permission: "VIEW_SYSTEM_HEALTH",
      },
      {
        href: "/admin/jobs",
        label: "Background Jobs",
        permission: "VIEW_BACKGROUND_JOBS",
      },
      {
        href: "/admin/backups",
        label: "Backups",
        permission: "VIEW_BACKUP_STATUS",
      },
      {
        href: "/admin/integrations",
        label: "Integrations",
        permission: "VIEW_INTEGRATIONS",
      },
      {
        href: "/admin/import-export",
        label: "Import & Export",
        permission: "EXPORT_OPERATIONAL_DATA",
      },
      {
        href: "/admin/tools",
        label: "Admin Tools",
        permission: "VIEW_ADMIN_TOOLS",
      },
      {
        href: "/admin/version",
        label: "Version & Deployment",
        permission: "VIEW_VERSION_INFORMATION",
      },
    ],
  },
];

export default function AdminShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { user } = useUser();
  const { role } = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );

  const groups = ADMIN_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) =>
      hasMatrixPermission(role, item.permission),
    ),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="text-xs text-slate-500">
        <Link href="/dashboard" className="hover:text-cyan-400">
          Matrix
        </Link>
        <span aria-hidden> / </span>
        <Link href="/admin" className="hover:text-cyan-400">
          Administration
        </Link>
        {pathname !== "/admin" ? (
          <>
            <span aria-hidden> / </span>
            <span className="text-cyan-400">{title}</span>
          </>
        ) : null}
      </nav>

      <div>
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        {subtitle ? (
          <p className="mt-1 max-w-3xl text-sm text-slate-400">{subtitle}</p>
        ) : null}
      </div>

      <nav
        aria-label="Administration sections"
        className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/30 p-3"
      >
        {groups.map((group) => (
          <div key={group.label}>
            <p className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {group.label}
            </p>
            <div className="-mx-1 flex gap-2 overflow-x-auto pb-1">
              {group.items.map((item) => {
                const active =
                  item.href === "/admin"
                    ? pathname === "/admin"
                    : pathname === item.href ||
                      pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`min-h-10 shrink-0 rounded-lg border px-3 py-2 text-sm ${
                      active
                        ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-200"
                        : "border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                    }`}
                    aria-current={active ? "page" : undefined}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div>{children}</div>
    </div>
  );
}
