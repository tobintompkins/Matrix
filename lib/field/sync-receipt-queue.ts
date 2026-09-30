export type FieldSyncReceiptListItem = {
  operationId: string;
  type: string;
  status: string;
  technicianName: string | null;
  workOrderId: string | null;
  printerId: string | null;
  createdAt: string;
  updatedAt: string;
  lastError: string | null;
};

export type FieldSyncReceiptFilter = {
  status: "ALL" | "RECEIVED" | "APPLIED" | "REJECTED";
  type: string;
  query: string;
};

export function filterFieldSyncReceipts(
  receipts: FieldSyncReceiptListItem[],
  filter: FieldSyncReceiptFilter,
): FieldSyncReceiptListItem[] {
  const query = filter.query.trim().toLocaleLowerCase();
  return receipts.filter((receipt) => {
    if (filter.status !== "ALL" && receipt.status !== filter.status) return false;
    if (filter.type !== "ALL" && receipt.type !== filter.type) return false;
    if (!query) return true;
    return [
      receipt.operationId,
      receipt.type,
      receipt.status,
      receipt.technicianName,
      receipt.workOrderId,
      receipt.printerId,
      receipt.lastError,
    ].some((value) => value?.toLocaleLowerCase().includes(query));
  });
}

export function listFieldSyncReceiptTypes(receipts: FieldSyncReceiptListItem[]): string[] {
  return [...new Set(receipts.map((receipt) => receipt.type).filter(Boolean))].sort();
}

function escapeCsvCell(value: string | null): string {
  const text = value ?? "";
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Creates a spreadsheet-safe, read-only handoff list for the current review filter. */
export function buildFieldSyncReceiptReviewCsv(receipts: FieldSyncReceiptListItem[]): string {
  const header = [
    "Receipt ID",
    "Type",
    "Status",
    "Work order",
    "Technician",
    "Printer",
    "Created at",
    "Updated at",
    "Review error",
  ];
  const rows = receipts.map((receipt) => [
    receipt.operationId,
    receipt.type,
    receipt.status,
    receipt.workOrderId,
    receipt.technicianName,
    receipt.printerId,
    receipt.createdAt,
    receipt.updatedAt,
    receipt.lastError,
  ].map(escapeCsvCell).join(","));

  return [header.map(escapeCsvCell).join(","), ...rows].join("\r\n");
}
