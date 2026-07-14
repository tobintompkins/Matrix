/**
 * Patch 49C — Admin reports catalog + CSV generation.
 */

import { listServiceCalls } from "@/lib/service-calls";
import { listAdminCustomers } from "@/lib/admin/data/customers";
import { listAdminMachines } from "@/lib/admin/data/machines";
import { listDeletedRecords } from "@/lib/admin/data/deleted-records";
import { listAdminParts, listAdminWarehouses } from "@/lib/admin/data/inventory";
import { listOperationalStates } from "@/lib/admin/data/operational-state";
import { toCsv } from "./csv";
import type { MatrixPermission } from "@/lib/auth/types";

export type AdminReportGroup =
  | "Access & Security"
  | "Operational Data"
  | "Service Operations"
  | "Customers & Machines"
  | "Parts & Inventory"
  | "System & Usage"
  | "Audit & Compliance";

export type AdminReportDefinition = {
  id: string;
  name: string;
  group: AdminReportGroup;
  description: string;
  permission: MatrixPermission;
  supportsExport: boolean;
};

export const ADMIN_REPORT_CATALOG: AdminReportDefinition[] = [
  {
    id: "service-calls-by-status",
    name: "Service Calls by Status",
    group: "Service Operations",
    description: "Open and closed service calls grouped by status.",
    permission: "VIEW_ADMIN_REPORTS",
    supportsExport: true,
  },
  {
    id: "service-calls-by-priority",
    name: "Service Calls by Priority",
    group: "Service Operations",
    description: "Active service calls by priority.",
    permission: "VIEW_ADMIN_REPORTS",
    supportsExport: true,
  },
  {
    id: "unassigned-calls",
    name: "Unassigned Calls",
    group: "Service Operations",
    description: "Open service calls without an assigned technician.",
    permission: "VIEW_ADMIN_REPORTS",
    supportsExport: true,
  },
  {
    id: "active-customers",
    name: "Active Customers",
    group: "Customers & Machines",
    description: "Active customer records (excludes deleted).",
    permission: "VIEW_ADMIN_REPORTS",
    supportsExport: true,
  },
  {
    id: "active-machines",
    name: "Active Machines",
    group: "Customers & Machines",
    description: "Active machines in the operational fleet.",
    permission: "VIEW_ADMIN_REPORTS",
    supportsExport: true,
  },
  {
    id: "retired-machines",
    name: "Retired Machines",
    group: "Customers & Machines",
    description: "Machines marked retired.",
    permission: "VIEW_ADMIN_REPORTS",
    supportsExport: true,
  },
  {
    id: "deleted-records",
    name: "Deleted Records",
    group: "Operational Data",
    description: "Soft-deleted operational records.",
    permission: "VIEW_DELETED_RECORDS",
    supportsExport: true,
  },
  {
    id: "archived-records",
    name: "Archived Records",
    group: "Operational Data",
    description: "Archived operational lifecycle states.",
    permission: "VIEW_ADMIN_REPORTS",
    supportsExport: true,
  },
  {
    id: "low-stock",
    name: "Low Stock Parts",
    group: "Parts & Inventory",
    description: "Parts catalog with inactive/archived status context.",
    permission: "VIEW_ADMIN_REPORTS",
    supportsExport: true,
  },
  {
    id: "stock-by-warehouse",
    name: "Stock by Warehouse",
    group: "Parts & Inventory",
    description: "Warehouse locations and on-hand totals.",
    permission: "VIEW_ADMIN_REPORTS",
    supportsExport: true,
  },
];

export function generateAdminReportCsv(reportId: string): {
  ok: true;
  filename: string;
  csv: string;
  rowCount: number;
} | { ok: false; error: string } {
  const def = ADMIN_REPORT_CATALOG.find((r) => r.id === reportId);
  if (!def) return { ok: false, error: "Report not found." };

  if (reportId === "service-calls-by-status") {
    const calls = listServiceCalls();
    const rows = calls.map((c) => [
      c.workOrderNumber,
      c.status,
      c.priority,
      c.machine.customerName,
      c.assignment.technician,
      c.createdAt.slice(0, 10),
    ]);
    return {
      ok: true,
      filename: `admin-service-calls-by-status-${dateStamp()}.csv`,
      csv: toCsv(
        ["WorkOrder", "Status", "Priority", "Customer", "Technician", "Created"],
        rows,
      ),
      rowCount: rows.length,
    };
  }

  if (reportId === "service-calls-by-priority") {
    const calls = listServiceCalls().filter(
      (c) => c.status !== "CLOSED" && c.status !== "CANCELLED",
    );
    const rows = calls.map((c) => [
      c.workOrderNumber,
      c.priority,
      c.status,
      c.machine.serialNumber,
    ]);
    return {
      ok: true,
      filename: `admin-service-calls-by-priority-${dateStamp()}.csv`,
      csv: toCsv(["WorkOrder", "Priority", "Status", "Serial"], rows),
      rowCount: rows.length,
    };
  }

  if (reportId === "unassigned-calls") {
    const rows = listServiceCalls()
      .filter((c) => !c.assignment.technician?.trim())
      .map((c) => [
        c.workOrderNumber,
        c.status,
        c.priority,
        c.machine.customerName,
      ]);
    return {
      ok: true,
      filename: `admin-unassigned-calls-${dateStamp()}.csv`,
      csv: toCsv(["WorkOrder", "Status", "Priority", "Customer"], rows),
      rowCount: rows.length,
    };
  }

  if (reportId === "active-customers") {
    const rows = listAdminCustomers({ recordState: "ACTIVE", pageSize: 5000 }).items.map(
      (c) => [c.customerNumber, c.name, c.status, c.industry],
    );
    return {
      ok: true,
      filename: `admin-active-customers-${dateStamp()}.csv`,
      csv: toCsv(["CustomerNumber", "Name", "Status", "Industry"], rows),
      rowCount: rows.length,
    };
  }

  if (reportId === "active-machines") {
    const rows = listAdminMachines({ recordState: "ACTIVE", pageSize: 5000 }).items.map(
      (m) => [
        m.machineId,
        m.nickname,
        m.serialNumber,
        m.customerName,
        m.status,
      ],
    );
    return {
      ok: true,
      filename: `admin-active-machines-${dateStamp()}.csv`,
      csv: toCsv(
        ["MachineId", "Name", "Serial", "Customer", "Status"],
        rows,
      ),
      rowCount: rows.length,
    };
  }

  if (reportId === "retired-machines") {
    const rows = listAdminMachines({ recordState: "RETIRED", pageSize: 5000 }).items.map(
      (m) => [m.machineId, m.nickname, m.serialNumber, m.customerName],
    );
    return {
      ok: true,
      filename: `admin-retired-machines-${dateStamp()}.csv`,
      csv: toCsv(["MachineId", "Name", "Serial", "Customer"], rows),
      rowCount: rows.length,
    };
  }

  if (reportId === "deleted-records") {
    const rows = listDeletedRecords({ pageSize: 5000 }).items.map((r) => [
      r.recordType,
      r.identifier,
      r.name,
      r.deletedAt.slice(0, 10),
      r.reason,
      r.retentionStatus,
    ]);
    return {
      ok: true,
      filename: `admin-deleted-records-${dateStamp()}.csv`,
      csv: toCsv(
        ["Type", "Identifier", "Name", "Deleted", "Reason", "Retention"],
        rows,
      ),
      rowCount: rows.length,
    };
  }

  if (reportId === "archived-records") {
    const rows = listOperationalStates({ lifecycle: "ARCHIVED" }).map((s) => [
      s.recordType,
      s.recordId,
      s.displayName ?? "",
      s.archivedAt?.slice(0, 10) ?? "",
      s.archiveReason ?? "",
    ]);
    return {
      ok: true,
      filename: `admin-archived-records-${dateStamp()}.csv`,
      csv: toCsv(
        ["Type", "RecordId", "Name", "Archived", "Reason"],
        rows,
      ),
      rowCount: rows.length,
    };
  }

  if (reportId === "low-stock") {
    const rows = listAdminParts({ status: "ACTIVE", pageSize: 5000 }).items.map(
      (p) => [p.partNumber, p.description, p.status, p.recordState],
    );
    return {
      ok: true,
      filename: `admin-parts-catalog-${dateStamp()}.csv`,
      csv: toCsv(["PartNumber", "Description", "Status", "RecordState"], rows),
      rowCount: rows.length,
    };
  }

  if (reportId === "stock-by-warehouse") {
    const rows = listAdminWarehouses().map((w) => [
      w.code,
      w.name,
      w.stockOnHand,
      w.transactionCount,
      w.active ? "Active" : "Inactive",
    ]);
    return {
      ok: true,
      filename: `admin-stock-by-warehouse-${dateStamp()}.csv`,
      csv: toCsv(
        ["Code", "Name", "OnHand", "Transactions", "Status"],
        rows,
      ),
      rowCount: rows.length,
    };
  }

  return { ok: false, error: "The report could not be generated." };
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}
