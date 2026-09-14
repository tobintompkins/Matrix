"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  EnterpriseTableToolbar,
  MatrixTable,
  exportRowsAsCsv,
  fleetStatusBadgeClassName,
  fleetStatusToVariant,
  useColumnVisibility,
  type MatrixTableColumn,
} from "@/app/components/ui";
import { buildWorkflowUrl, withFrom } from "@/lib/workflow/routes";

export type FleetRow = {
  assetId: string;
  model: string;
  location: string;
  status: string;
  meterCount: string;
  lastService: string;
};

const COLUMN_OPTIONS = [
  { key: "assetId", label: "Asset ID", locked: true },
  { key: "model", label: "Model" },
  { key: "location", label: "Location" },
  { key: "status", label: "Status", locked: true },
  { key: "meterCount", label: "Meter Count" },
  { key: "lastService", label: "Last Service" },
];

const fleetColumns: MatrixTableColumn<FleetRow>[] = [
  {
    key: "assetId",
    header: "Asset ID",
    sortable: true,
    render: (row) => (
      <Link
        href={buildWorkflowUrl(
          `/printers/${row.assetId.toLowerCase()}`,
          withFrom(
            {
              customer: "SFX / MPX",
              assetId: row.assetId,
              printer: row.assetId.toLowerCase(),
              model: row.model,
            },
            "digital-twin",
          ),
        )}
        className="font-medium text-cyan-400 hover:text-cyan-300"
      >
        {row.assetId}
      </Link>
    ),
  },
  { key: "model", header: "Model", sortable: true },
  {
    key: "location",
    header: "Location",
    sortable: true,
    className: "text-slate-300",
  },
  { key: "status", header: "Status", sortable: true },
  { key: "meterCount", header: "Meter Count", sortable: true },
  {
    key: "lastService",
    header: "Last Service",
    sortable: true,
    className: "text-slate-300",
  },
];

type FleetTableProps = {
  data: FleetRow[];
};

export default function FleetTable({ data }: FleetTableProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [model, setModel] = useState("");
  const columnsVisibility = useColumnVisibility("fleet-machines", COLUMN_OPTIONS);

  const models = useMemo(
    () => Array.from(new Set(data.map((row) => row.model))).sort(),
    [data],
  );
  const statuses = useMemo(
    () => Array.from(new Set(data.map((row) => row.status))).sort(),
    [data],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((row) => {
      if (status && row.status !== status) return false;
      if (model && row.model !== model) return false;
      if (!q) return true;
      return (
        row.assetId.toLowerCase().includes(q) ||
        row.model.toLowerCase().includes(q) ||
        row.location.toLowerCase().includes(q) ||
        row.status.toLowerCase().includes(q)
      );
    });
  }, [data, search, status, model]);

  const activeFilterLabels = [
    search.trim() ? `Search: ${search.trim()}` : null,
    status ? `Status: ${status}` : null,
    model ? `Model: ${model}` : null,
  ].filter(Boolean) as string[];

  return (
    <div>
      <EnterpriseTableToolbar
        searchPlaceholder="Search machines"
        searchValue={search}
        onSearchChange={setSearch}
        resultCount={filtered.length}
        resultLabel="machines"
        activeFilterLabels={activeFilterLabels}
        onClearFilters={() => {
          setSearch("");
          setStatus("");
          setModel("");
        }}
        onExport={() =>
          exportRowsAsCsv("machines-filtered", filtered, [
            { key: "assetId", header: "Asset ID", value: (r) => r.assetId },
            { key: "model", header: "Model", value: (r) => r.model },
            { key: "location", header: "Location", value: (r) => r.location },
            { key: "status", header: "Status", value: (r) => r.status },
            {
              key: "meterCount",
              header: "Meter Count",
              value: (r) => r.meterCount,
            },
            {
              key: "lastService",
              header: "Last Service",
              value: (r) => r.lastService,
            },
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
          {
            id: "model",
            label: "Model",
            value: model,
            allLabel: "All models",
            onChange: setModel,
            options: models.map((m) => ({ value: m, label: m })),
          },
        ]}
      />

      <MatrixTable
        columns={fleetColumns}
        data={filtered}
        rowKey={(row) => row.assetId}
        searchable={false}
        paginated
        pageSize={25}
        pageSizeOptions={[10, 25, 50, 100]}
        visibleColumnKeys={columnsVisibility.visibleKeys}
        stickyHeader
        compact
        emptyTitle={
          activeFilterLabels.length > 0
            ? "No machines match these filters"
            : "No machines found"
        }
        emptyDescription={
          activeFilterLabels.length > 0
            ? "Clear filters to view more results."
            : "Machine records will appear here when available."
        }
        statusConfig={{
          columnKey: "status",
          getVariant: (row) => fleetStatusToVariant(row.status),
          getLabel: (row) => row.status,
          getClassName: (row) => fleetStatusBadgeClassName(row.status),
        }}
      />
    </div>
  );
}
