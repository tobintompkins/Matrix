/**
 * Patch 51A.2 — Client-safe automation event notify (HTTP).
 * Keeps Prisma emit off the client bundle.
 */

export function notifyServiceCallCreated(call: {
  id: string;
  workOrderNumber?: string;
  priority?: string;
  status?: string;
  machine?: {
    machineId?: string;
    serialNumber?: string;
    customerName?: string;
  };
  problem?: {
    problemDescription?: string;
    issueTitle?: string;
  };
}) {
  void fetch("/api/ai-operations/automations/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventType: "service_call.created",
      entityType: "ServiceCall",
      entityId: call.id,
      payload: {
        serviceCallId: call.id,
        workOrderNumber: call.workOrderNumber,
        priority: call.priority,
        status: call.status,
        machineId: call.machine?.machineId,
        serialNumber: call.machine?.serialNumber,
        customerName: call.machine?.customerName,
        problemDescription: call.problem?.problemDescription ?? "",
        issueTitle: call.problem?.issueTitle ?? "",
      },
    }),
  }).catch(() => {
    /* never block UI */
  });

  const machineId = call.machine?.machineId;
  if (machineId) {
    notifyPredictiveReEvaluation(machineId, "service_call.created");
  }
}

export function notifyServiceCallClosed(call: {
  id: string;
  status?: string;
  machine?: { machineId?: string };
}) {
  void fetch("/api/ai-operations/automations/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventType: "service_call.closed",
      entityType: "ServiceCall",
      entityId: call.id,
      payload: {
        serviceCallId: call.id,
        status: call.status,
        machineId: call.machine?.machineId,
      },
    }),
  }).catch(() => {});

  const machineId = call.machine?.machineId;
  if (machineId) {
    notifyPredictiveReEvaluation(machineId, "service_call.closed");
  }
}

export function notifyPredictiveReEvaluation(machineId: string, reason: string) {
  if (!machineId) return;
  void fetch("/api/ai-operations/automations/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventType: "predictive.reevaluate_requested",
      entityType: "Machine",
      entityId: machineId,
      payload: { machineId, reason, requestedAt: new Date().toISOString() },
    }),
  }).catch(() => {});
}
