"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useUser } from "@clerk/nextjs";
import AdminShell from "../../components/admin/AdminShell";
import {
  hasMatrixPermission,
  resolveMatrixRole,
} from "@/lib/auth/permissions";
import type { MatrixPermission } from "@/lib/auth/types";
import { listAdminServiceCalls } from "@/lib/admin/data/service-calls";
import { listAdminCustomers } from "@/lib/admin/data/customers";
import { listAdminMachines } from "@/lib/admin/data/machines";
import { listDeletedRecords } from "@/lib/admin/data/deleted-records";
import { listOperationalStates } from "@/lib/admin/data/operational-state";

type Card = {
  href: string;
  title: string;
  detail: string;
  permission: MatrixPermission;
};

export default function DataAdministrationPage() {
  const { user } = useUser();
  const { role } = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );

  const cards = useMemo(() => {
    const serviceCalls = listAdminServiceCalls({
      recordState: "ACTIVE",
      pageSize: 1,
    });
    const customers = listAdminCustomers({ recordState: "ACTIVE", pageSize: 1 });
    const machines = listAdminMachines({ recordState: "ACTIVE", pageSize: 1 });
    const deleted = listDeletedRecords({ pageSize: 1 });
    const archived = listOperationalStates({ lifecycle: "ARCHIVED" }).length;
    const recentCorrections = listOperationalStates().filter(
      (s) => s.lifecycle !== "ACTIVE",
    ).length;

    const all: Card[] = [
      {
        href: "/admin/service-calls",
        title: "Service Calls",
        detail: `${serviceCalls.total} active records`,
        permission: "ADMIN_EDIT_SERVICE_CALL",
      },
      {
        href: "/admin/customers",
        title: "Customers",
        detail: `${customers.total} active records`,
        permission: "ADMIN_EDIT_CUSTOMER",
      },
      {
        href: "/admin/machines",
        title: "Machines",
        detail: `${machines.total} active records`,
        permission: "ADMIN_EDIT_MACHINE",
      },
      {
        href: "/admin/preventive-maintenance",
        title: "PM Records",
        detail: "Administer schedules and history via existing PM system",
        permission: "ADMIN_EDIT_PM",
      },
      {
        href: "/admin/meters",
        title: "Meter Records",
        detail: "Correct, invalidate, and restore meter entries",
        permission: "ADMIN_EDIT_METER",
      },
      {
        href: "/admin/deleted-records",
        title: "Deleted Records",
        detail: `${deleted.total} soft-deleted records`,
        permission: "VIEW_DELETED_RECORDS",
      },
      {
        href: "/admin/archived-records",
        title: "Archived Records",
        detail: `${archived} archived · restore and deletion preview`,
        permission: "VIEW_ARCHIVED_RECORDS",
      },
      {
        href: "/admin/managed-content",
        title: "Managed Content",
        detail: "Announcements, help text, notices (sanitized)",
        permission: "MANAGE_ADMIN_CONTENT",
      },
      {
        href: "/admin/audit",
        title: "Recent Data Corrections",
        detail: `${recentCorrections} archive/delete state changes in this session`,
        permission: "VIEW_AUDIT_HISTORY",
      },
      {
        href: "/admin/deleted-records",
        title: "Protected Records",
        detail: `${archived} archived · permanent delete restricted when history exists`,
        permission: "VIEW_DELETED_RECORDS",
      },
    ];
    return all.filter((c) => hasMatrixPermission(role, c.permission));
  }, [role]);

  return (
    <AdminShell
      title="Data Administration"
      subtitle="Correct, archive, delete, restore, and review operational records while preserving Matrix history and data integrity."
    >
      <p className="mb-4 text-sm text-slate-400">
        Matrix uses archival and soft deletion to preserve operational history.
        Permanent deletion is restricted and must never compromise service,
        inventory, financial, warranty, compliance, or audit integrity.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={`${card.href}-${card.title}`}
            href={card.href}
            className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 transition hover:border-cyan-500/40"
          >
            <h2 className="text-base font-semibold text-white">{card.title}</h2>
            <p className="mt-1 text-sm text-slate-400">{card.detail}</p>
          </Link>
        ))}
      </div>
      {cards.length === 0 ? (
        <p className="text-sm text-slate-500">
          No operational records match the selected filters.
        </p>
      ) : null}
    </AdminShell>
  );
}
