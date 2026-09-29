import type { CreateWorkOrderInput, WorkOrder, WorkOrderAttachmentKind, WorkOrderStatus } from "./types";
import { quickActionTarget } from "./workflow";

export type OfficeServerWriteResult =
  | { ok: true; workOrder: WorkOrder }
  | { ok: false; error: string };

type OfficeWriteResponse = {
  ok?: boolean;
  workOrder?: WorkOrder;
  error?: string;
};

async function parseOfficeWriteResponse(response: Response): Promise<OfficeServerWriteResult> {
  const body = (await response.json()) as OfficeWriteResponse;
  if (!response.ok || !body.workOrder) {
    return { ok: false, error: body.error ?? "Server work order request failed." };
  }
  return { ok: true, workOrder: body.workOrder };
}

function workOrderKey(order: Pick<WorkOrder, "id" | "workOrderNumber">): string {
  return order.id || order.workOrderNumber;
}

export function appendWorkOrderNoteText(current: string, addition: string): string {
  const trimmed = addition.trim();
  if (!trimmed) return current;
  return [current, trimmed].filter(Boolean).join("\n");
}

export async function createServerOfficeWorkOrder(
  input: CreateWorkOrderInput,
): Promise<OfficeServerWriteResult> {
  try {
    const response = await fetch("/api/work-orders/server", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    return parseOfficeWriteResponse(response);
  } catch {
    return { ok: false, error: "Could not create server work order." };
  }
}

export async function patchServerOfficeWorkOrderStatus(
  order: WorkOrder,
  status: WorkOrderStatus,
): Promise<OfficeServerWriteResult> {
  try {
    const response = await fetch(
      `/api/work-orders/server/${encodeURIComponent(workOrderKey(order))}/status`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      },
    );
    return parseOfficeWriteResponse(response);
  } catch {
    return { ok: false, error: "Could not update server work order status." };
  }
}

export async function runServerOfficeQuickAction(
  order: WorkOrder,
  action: "start" | "pause" | "resume" | "complete",
): Promise<OfficeServerWriteResult> {
  const target = quickActionTarget(action, order.status);
  if (!target) {
    return { ok: false, error: `Cannot ${action} from status ${order.status}.` };
  }
  return patchServerOfficeWorkOrderStatus(order, target);
}

export async function patchServerOfficeWorkOrderAssignment(
  order: WorkOrder,
  input: {
    assignedTechnician?: string;
    secondaryTechnician?: string;
    assignedTechnicianId?: string | null;
    secondaryTechnicianId?: string | null;
  },
): Promise<OfficeServerWriteResult> {
  try {
    const response = await fetch(
      `/api/work-orders/server/${encodeURIComponent(workOrderKey(order))}/assignment`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      },
    );
    return parseOfficeWriteResponse(response);
  } catch {
    return { ok: false, error: "Could not update server assignment." };
  }
}

export async function patchServerOfficeWorkOrderSchedule(
  order: WorkOrder,
  input: { scheduledStart?: string | null; scheduledEnd?: string | null },
): Promise<OfficeServerWriteResult> {
  try {
    const response = await fetch(
      `/api/work-orders/server/${encodeURIComponent(workOrderKey(order))}/schedule`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      },
    );
    return parseOfficeWriteResponse(response);
  } catch {
    return { ok: false, error: "Could not update server schedule." };
  }
}

export async function appendServerOfficeWorkOrderNote(
  order: WorkOrder,
  input: { note: string; internal?: boolean },
): Promise<OfficeServerWriteResult> {
  if (!input.note.trim()) return { ok: false, error: "Note is required." };
  const body = input.internal
    ? { internalNotes: appendWorkOrderNoteText(order.internalNotes, input.note) }
    : { notes: appendWorkOrderNoteText(order.notes, input.note) };
  try {
    const response = await fetch(
      `/api/work-orders/server/${encodeURIComponent(workOrderKey(order))}/notes`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    return parseOfficeWriteResponse(response);
  } catch {
    return { ok: false, error: "Could not update server notes." };
  }
}

export async function addServerOfficeWorkOrderPart(
  order: WorkOrder,
  input: { partNumber: string; description?: string; quantity?: number },
): Promise<OfficeServerWriteResult> {
  try {
    const response = await fetch(
      `/api/work-orders/server/${encodeURIComponent(workOrderKey(order))}/parts`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      },
    );
    return parseOfficeWriteResponse(response);
  } catch {
    return { ok: false, error: "Could not add server part line." };
  }
}

export async function patchServerOfficeWorkOrderLabor(
  order: WorkOrder,
  input: {
    actualHours?: number | null;
    estimatedHours?: number | null;
    travelTime?: number | null;
    mileage?: number | null;
  },
): Promise<OfficeServerWriteResult> {
  try {
    const response = await fetch(
      `/api/work-orders/server/${encodeURIComponent(workOrderKey(order))}/labor`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      },
    );
    return parseOfficeWriteResponse(response);
  } catch {
    return { ok: false, error: "Could not update server labor." };
  }
}

export async function addServerOfficeWorkOrderAttachment(
  order: WorkOrder,
  input: { fileName: string; kind: WorkOrderAttachmentKind },
): Promise<OfficeServerWriteResult> {
  try {
    const response = await fetch(
      `/api/work-orders/server/${encodeURIComponent(workOrderKey(order))}/attachments`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fileName: input.fileName,
          kind: input.kind,
          mimeType: "application/octet-stream",
          sizeBytes: 0,
          storageRef: `office-placeholder://${input.fileName}`,
        }),
      },
    );
    return parseOfficeWriteResponse(response);
  } catch {
    return { ok: false, error: "Could not add server attachment." };
  }
}
