import type { WorkOrder } from "./types";

export type WorkOrderCompareRow = {
  id: string;
  workOrderNumber: string;
  legacyWorkOrderId: string | null;
  title: string;
  assignedTechnician: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  status: string;
  updatedAt: string;
};

export type WorkOrderFieldMismatch = {
  field: "assignedTechnician" | "scheduledStart" | "scheduledEnd" | "status" | "updatedAt";
  browserValue: string;
  serverValue: string;
};

export type WorkOrderMatchedPair = {
  browser: WorkOrderCompareRow;
  server: WorkOrderCompareRow;
  mismatches: WorkOrderFieldMismatch[];
};

export type WorkOrderQueueComparison = {
  browserCount: number;
  serverCount: number;
  matchedCount: number;
  missingOnServer: WorkOrderCompareRow[];
  missingOnBrowser: WorkOrderCompareRow[];
  matched: WorkOrderMatchedPair[];
  mismatchCount: number;
  readyForOfficeFlag: boolean;
};

const COMPARE_FIELDS = [
  "assignedTechnician",
  "scheduledStart",
  "scheduledEnd",
  "status",
  "updatedAt",
] as const;

function normText(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function normInstant(value: string | null | undefined): string {
  const text = normText(value);
  if (!text) return "";
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? text : parsed.toISOString();
}

export function workOrderToBrowserCompareRow(order: WorkOrder): WorkOrderCompareRow {
  return {
    id: order.id,
    workOrderNumber: order.workOrderNumber,
    legacyWorkOrderId: null,
    title: order.title,
    assignedTechnician: normText(order.assignedTechnician),
    scheduledStart: order.scheduledStart,
    scheduledEnd: order.scheduledEnd,
    status: normText(order.status),
    updatedAt: normInstant(order.updatedAt),
  };
}

export function workOrderToServerCompareRow(order: {
  id: string;
  workOrderNumber: string;
  legacyWorkOrderId: string | null;
  title: string;
  assignedTechnician: string | null;
  scheduledStart: Date | null;
  scheduledEnd: Date | null;
  status: string | null;
  updatedAt: Date;
}): WorkOrderCompareRow {
  return {
    id: order.id,
    workOrderNumber: order.workOrderNumber,
    legacyWorkOrderId: order.legacyWorkOrderId,
    title: order.title,
    assignedTechnician: normText(order.assignedTechnician),
    scheduledStart: order.scheduledStart?.toISOString() ?? null,
    scheduledEnd: order.scheduledEnd?.toISOString() ?? null,
    status: normText(order.status),
    updatedAt: normInstant(order.updatedAt.toISOString()),
  };
}

function diffCompareRows(
  browser: WorkOrderCompareRow,
  server: WorkOrderCompareRow,
): WorkOrderFieldMismatch[] {
  const mismatches: WorkOrderFieldMismatch[] = [];
  for (const field of COMPARE_FIELDS) {
    const left =
      field === "scheduledStart" || field === "scheduledEnd" || field === "updatedAt"
        ? normInstant(browser[field])
        : normText(browser[field]);
    const right =
      field === "scheduledStart" || field === "scheduledEnd" || field === "updatedAt"
        ? normInstant(server[field])
        : normText(server[field]);
    if (left !== right) {
      mismatches.push({
        field,
        browserValue: left || "—",
        serverValue: right || "—",
      });
    }
  }
  return mismatches;
}

function findServerMatch(
  browser: WorkOrderCompareRow,
  unusedServer: Map<string, WorkOrderCompareRow>,
): WorkOrderCompareRow | undefined {
  for (const server of unusedServer.values()) {
    if (server.workOrderNumber === browser.workOrderNumber) return server;
  }
  for (const server of unusedServer.values()) {
    if (server.legacyWorkOrderId && server.legacyWorkOrderId === browser.id) return server;
  }
  for (const server of unusedServer.values()) {
    if (server.id === browser.id) return server;
  }
  return undefined;
}

export function compareWorkOrderQueues(
  browser: WorkOrderCompareRow[],
  server: WorkOrderCompareRow[],
): WorkOrderQueueComparison {
  const unusedServer = new Map(server.map((row) => [row.id, row]));
  const missingOnServer: WorkOrderCompareRow[] = [];
  const matched: WorkOrderMatchedPair[] = [];

  for (const browserRow of browser) {
    const serverRow = findServerMatch(browserRow, unusedServer);
    if (!serverRow) {
      missingOnServer.push(browserRow);
      continue;
    }
    unusedServer.delete(serverRow.id);
    const mismatches = diffCompareRows(browserRow, serverRow);
    matched.push({ browser: browserRow, server: serverRow, mismatches });
  }

  const missingOnBrowser = [...unusedServer.values()];
  const mismatchCount = matched.reduce((sum, pair) => sum + pair.mismatches.length, 0);

  return {
    browserCount: browser.length,
    serverCount: server.length,
    matchedCount: matched.length,
    missingOnServer,
    missingOnBrowser,
    matched,
    mismatchCount,
    readyForOfficeFlag:
      missingOnServer.length === 0 &&
      missingOnBrowser.length === 0 &&
      mismatchCount === 0,
  };
}
