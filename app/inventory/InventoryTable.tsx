"use client";

import {
  MatrixTable,
  inventoryStatusBadgeClassName,
  inventoryStatusToVariant,
  type MatrixTableColumn,
} from "@/app/components/ui";

export type InventoryRow = {
  partNumber: string;
  partName: string;
  compatibleModel: string;
  quantity: number;
  reorderLevel: number;
  status: string;
  location: string;
};

const inventoryColumns: MatrixTableColumn<InventoryRow>[] = [
  {
    key: "partNumber",
    header: "Part #",
    sortable: true,
    className: "font-medium text-cyan-400",
  },
  {
    key: "partName",
    header: "Part Name",
    sortable: true,
    className: "text-white",
  },
  {
    key: "compatibleModel",
    header: "Compatible Model",
    sortable: true,
    className: "text-slate-300",
  },
  { key: "quantity", header: "Quantity", sortable: true },
  {
    key: "reorderLevel",
    header: "Reorder Level",
    sortable: true,
    className: "text-slate-300",
  },
  { key: "status", header: "Status", sortable: true },
  {
    key: "location",
    header: "Location",
    sortable: true,
    className: "text-slate-300",
  },
];

type InventoryTableProps = {
  data: InventoryRow[];
};

export default function InventoryTable({ data }: InventoryTableProps) {
  return (
    <MatrixTable
      columns={inventoryColumns}
      data={data}
      rowKey={(row) => row.partNumber}
      searchable={false}
      paginated={false}
      statusConfig={{
        columnKey: "status",
        getVariant: (row) => inventoryStatusToVariant(row.status),
        getLabel: (row) => row.status,
        getClassName: (row) => inventoryStatusBadgeClassName(row.status),
      }}
    />
  );
}
