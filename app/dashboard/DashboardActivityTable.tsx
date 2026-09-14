"use client";

import {
  MatrixTable,
  ticketStatusBadgeClassName,
  ticketStatusToVariant,
  type MatrixTableColumn,
} from "../components/ui";

export type ActivityRow = {
  date: string;
  customer: string;
  printer: string;
  issue: string;
  status: string;
};

const activityColumns: MatrixTableColumn<ActivityRow>[] = [
  { key: "date", header: "Date", sortable: true, className: "text-slate-300" },
  { key: "customer", header: "Customer", sortable: true },
  {
    key: "printer",
    header: "Printer",
    sortable: true,
    className: "text-slate-300",
  },
  {
    key: "issue",
    header: "Issue",
    sortable: true,
    className: "max-w-xs text-slate-300",
  },
  { key: "status", header: "Status", sortable: true },
];

type DashboardActivityTableProps = {
  data: ActivityRow[];
};

export default function DashboardActivityTable({
  data,
}: DashboardActivityTableProps) {
  return (
    <MatrixTable
      columns={activityColumns}
      data={data}
      rowKey={(row) => `${row.date}-${row.printer}`}
      searchable={false}
      paginated={false}
      stickyHeader
      compact
      statusConfig={{
        columnKey: "status",
        getVariant: (row) => ticketStatusToVariant(row.status),
        getLabel: (row) => row.status,
        getClassName: (row) => ticketStatusBadgeClassName(row.status),
      }}
    />
  );
}
