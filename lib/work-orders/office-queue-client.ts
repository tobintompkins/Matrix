import type {
  WorkOrder,
  WorkOrderAuditEntry,
  WorkOrderTimelineEvent,
  WorkOrderTimelineEventType,
} from "./types";

export type OfficeQueueLoadState = "idle" | "loading" | "ready" | "error";

export type OfficeQueueListResponse =
  | { ok: true; workOrders: WorkOrder[]; officeFlagEnabled?: boolean }
  | { ok: false; error: string };

export type OfficeQueueDetailResponse =
  | {
      ok: true;
      workOrder: WorkOrder;
      timeline: WorkOrderTimelineEvent[];
      audit: WorkOrderAuditEntry[];
      officeFlagEnabled?: boolean;
    }
  | { ok: false; error: string };

/** Env flag only. Effective queue source uses {@link resolveOfficeQueueRollout}. */
export function resolveOfficeQueueSource(
  serverOfficeQueueEnabled: boolean,
): "browser" | "server" {
  return serverOfficeQueueEnabled ? "server" : "browser";
}

export async function fetchServerOfficeWorkOrders(): Promise<OfficeQueueListResponse> {
  try {
    const response = await fetch("/api/work-orders/server", { cache: "no-store" });
    const body = (await response.json()) as {
      ok?: boolean;
      workOrders?: WorkOrder[];
      error?: string;
    };
    if (!response.ok || !body.workOrders) {
      return { ok: false, error: body.error ?? "Could not load server work orders." };
    }
    return { ok: true, workOrders: body.workOrders, officeFlagEnabled: body.ok };
  } catch {
    return { ok: false, error: "Could not load server work orders." };
  }
}

export async function fetchServerOfficeWorkOrderDetail(
  workOrderKey: string,
): Promise<OfficeQueueDetailResponse> {
  try {
    const response = await fetch(
      `/api/work-orders/server/${encodeURIComponent(workOrderKey)}`,
      { cache: "no-store" },
    );
    const body = (await response.json()) as {
      ok?: boolean;
      workOrder?: WorkOrder;
      timeline?: WorkOrderTimelineEvent[];
      audit?: WorkOrderAuditEntry[];
      error?: string;
    };
    if (!response.ok || !body.workOrder) {
      return { ok: false, error: body.error ?? "Could not load server work order." };
    }
    return {
      ok: true,
      workOrder: body.workOrder,
      timeline: body.timeline ?? [],
      audit: body.audit ?? [],
    };
  } catch {
    return { ok: false, error: "Could not load server work order." };
  }
}

export function mapServerTimelineRow(row: {
  id: string;
  workOrderId: string;
  type: string;
  title: string | null;
  description: string | null;
  actor: string | null;
  occurredAt: Date;
  previousValue: string | null;
  newValue: string | null;
}): WorkOrderTimelineEvent {
  return {
    id: row.id,
    workOrderId: row.workOrderId,
    type: row.type as WorkOrderTimelineEventType,
    title: row.title ?? "",
    description: row.description ?? "",
    actor: row.actor ?? "",
    occurredAt: row.occurredAt.toISOString(),
    previousValue: row.previousValue,
    newValue: row.newValue,
  };
}

export function mapServerAuditRow(row: {
  id: string;
  workOrderId: string;
  field: string;
  previousValue: string | null;
  newValue: string | null;
  actor: string | null;
  occurredAt: Date;
  action: string | null;
}): WorkOrderAuditEntry {
  return {
    id: row.id,
    workOrderId: row.workOrderId,
    field: row.field,
    previousValue: row.previousValue ?? "",
    newValue: row.newValue ?? "",
    actor: row.actor ?? "",
    occurredAt: row.occurredAt.toISOString(),
    action: row.action ?? "",
  };
}
