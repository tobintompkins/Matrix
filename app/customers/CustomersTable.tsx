"use client";

import Link from "next/link";
import {
  MatrixTable,
  customerStatusBadgeClassName,
  customerStatusToVariant,
  type MatrixTableColumn,
} from "@/app/components/ui";
import { buildWorkflowUrl, withFrom } from "@/lib/workflow/routes";

export type CustomerRow = {
  name: string;
  siteLocation: string;
  contact: string;
  phone: string;
  printers: number;
  status: string;
  defaultAssetId: string;
  defaultPrinter: string;
  defaultModel: string;
  crmId?: string;
};

const customerColumns: MatrixTableColumn<CustomerRow>[] = [
  {
    key: "name",
    header: "Customer Name",
    sortable: true,
    className: "font-medium text-white",
    render: (row) =>
      row.crmId ? (
        <Link href={`/customers/${row.crmId}`} className="hover:text-cyan-300">
          {row.name}
        </Link>
      ) : (
        row.name
      ),
  },
  {
    key: "siteLocation",
    header: "Site Location",
    sortable: true,
    className: "text-slate-300",
  },
  { key: "contact", header: "Contact", sortable: true },
  {
    key: "phone",
    header: "Phone",
    sortable: true,
    className: "text-slate-300",
  },
  { key: "printers", header: "Printers", sortable: true },
  { key: "status", header: "Status", sortable: true },
  {
    key: "workflow",
    header: "Workflow",
    render: (row) => (
      <Link
        href={buildWorkflowUrl(
          `/printers/${row.defaultPrinter}`,
          withFrom(
            {
              customer: row.name,
              assetId: row.defaultAssetId,
              printer: row.defaultPrinter,
              model: row.defaultModel,
            },
            "customer",
          ),
        )}
        className="text-sm font-medium text-cyan-400 hover:text-cyan-300"
      >
        Open Printer →
      </Link>
    ),
  },
];

type CustomersTableProps = {
  data: CustomerRow[];
};

export default function CustomersTable({ data }: CustomersTableProps) {
  return (
    <MatrixTable
      columns={customerColumns}
      data={data}
      rowKey={(row) => row.name}
      searchable={false}
      paginated={false}
      statusConfig={{
        columnKey: "status",
        getVariant: (row) => customerStatusToVariant(row.status),
        getLabel: (row) => row.status,
        getClassName: (row) => customerStatusBadgeClassName(row.status),
      }}
    />
  );
}
