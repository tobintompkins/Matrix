"use client";

import Link from "next/link";
import {
  MatrixTable,
  fleetStatusBadgeClassName,
  fleetStatusToVariant,
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
  return (
    <MatrixTable
      columns={fleetColumns}
      data={data}
      rowKey={(row) => row.assetId}
      searchable={false}
      paginated={false}
      statusConfig={{
        columnKey: "status",
        getVariant: (row) => fleetStatusToVariant(row.status),
        getLabel: (row) => row.status,
        getClassName: (row) => fleetStatusBadgeClassName(row.status),
      }}
    />
  );
}
