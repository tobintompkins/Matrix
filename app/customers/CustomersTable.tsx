"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  EnterpriseTableToolbar,
  MatrixTable,
  customerStatusBadgeClassName,
  customerStatusToVariant,
  exportRowsAsCsv,
  useColumnVisibility,
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

const COLUMN_OPTIONS = [
  { key: "name", label: "Customer Name", locked: true },
  { key: "siteLocation", label: "Site Location" },
  { key: "contact", label: "Contact" },
  { key: "phone", label: "Phone" },
  { key: "printers", label: "Printers" },
  { key: "status", label: "Status", locked: true },
  { key: "workflow", label: "Workflow", locked: true },
];

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
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const columnsVisibility = useColumnVisibility("customers-legacy", COLUMN_OPTIONS);

  const statuses = useMemo(
    () => Array.from(new Set(data.map((row) => row.status))).sort(),
    [data],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((row) => {
      if (status && row.status !== status) return false;
      if (!q) return true;
      return (
        row.name.toLowerCase().includes(q) ||
        row.siteLocation.toLowerCase().includes(q) ||
        row.contact.toLowerCase().includes(q) ||
        row.phone.toLowerCase().includes(q)
      );
    });
  }, [data, search, status]);

  const activeFilterLabels = [
    search.trim() ? `Search: ${search.trim()}` : null,
    status ? `Status: ${status}` : null,
  ].filter(Boolean) as string[];

  return (
    <div>
      <EnterpriseTableToolbar
        searchPlaceholder="Search customers"
        searchValue={search}
        onSearchChange={setSearch}
        resultCount={filtered.length}
        resultLabel="customers"
        activeFilterLabels={activeFilterLabels}
        onClearFilters={() => {
          setSearch("");
          setStatus("");
        }}
        onExport={() =>
          exportRowsAsCsv("customers-filtered", filtered, [
            { key: "name", header: "Customer", value: (r) => r.name },
            {
              key: "siteLocation",
              header: "Site",
              value: (r) => r.siteLocation,
            },
            { key: "contact", header: "Contact", value: (r) => r.contact },
            { key: "phone", header: "Phone", value: (r) => r.phone },
            { key: "printers", header: "Printers", value: (r) => r.printers },
            { key: "status", header: "Status", value: (r) => r.status },
          ])
        }
        exportLabel="Export CSV (filtered results)"
        columnOptions={COLUMN_OPTIONS}
        visibleColumnKeys={columnsVisibility.visibleKeys}
        onToggleColumn={columnsVisibility.toggle}
        selectFilters={[
          {
            id: "status",
            label: "Status",
            value: status,
            allLabel: "All statuses",
            onChange: setStatus,
            options: statuses.map((s) => ({ value: s, label: s })),
          },
        ]}
      />

      <MatrixTable
        columns={customerColumns}
        data={filtered}
        rowKey={(row) => row.name}
        searchable={false}
        paginated
        pageSize={25}
        pageSizeOptions={[10, 25, 50, 100]}
        visibleColumnKeys={columnsVisibility.visibleKeys}
        stickyHeader
        compact
        emptyTitle={
          activeFilterLabels.length > 0
            ? "No customers match these filters"
            : "No customers found"
        }
        emptyDescription={
          activeFilterLabels.length > 0
            ? "Clear filters to view more results."
            : "Customer accounts will appear here when available."
        }
        statusConfig={{
          columnKey: "status",
          getVariant: (row) => customerStatusToVariant(row.status),
          getLabel: (row) => row.status,
          getClassName: (row) => customerStatusBadgeClassName(row.status),
        }}
      />
    </div>
  );
}
