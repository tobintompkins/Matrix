import {
  SESSION_ACTIONS_REQUIRING_REASON,
  type WorkSession,
  type WorkSessionAction,
  type WorkSessionEvent,
} from "./types";
import { getOfflineStore, newEntityId } from "./store";
import { appendFieldAudit } from "./queue";

function nowIso() {
  return new Date().toISOString();
}

function msBetween(a: string | null, b: string | null): number {
  if (!a || !b) return 0;
  return Math.max(0, new Date(b).getTime() - new Date(a).getTime());
}

export function sessionActionRequiresReason(action: WorkSessionAction): boolean {
  return SESSION_ACTIONS_REQUIRING_REASON.includes(action) || action === "PAUSE_WORK";
}

/** Also treat hold-like actions as requiring reason (spec). */
export function validateSessionAction(
  action: WorkSessionAction,
  reason: string | null | undefined,
): { ok: boolean; error?: string } {
  if (sessionActionRequiresReason(action) && !reason?.trim()) {
    return { ok: false, error: `A reason is required for ${action.replaceAll("_", " ").toLowerCase()}.` };
  }
  return { ok: true };
}

export async function getActiveSessionForTechnician(
  technicianId: string,
): Promise<WorkSession | null> {
  const sessions = await getOfflineStore().getAll<WorkSession & { id: string }>("sessions");
  return sessions.find((s) => s.technicianId === technicianId && s.active) ?? null;
}

export async function getSessionForWorkOrder(
  workOrderId: string,
  technicianId?: string,
): Promise<WorkSession | null> {
  const sessions = await getOfflineStore().getAll<WorkSession & { id: string }>("sessions");
  return (
    sessions
      .filter((s) => s.workOrderId === workOrderId && (!technicianId || s.technicianId === technicianId))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null
  );
}

export async function applyWorkSessionAction(input: {
  workOrderId: string;
  technicianId: string;
  technicianName: string;
  action: WorkSessionAction;
  reason?: string | null;
  at?: string;
}): Promise<{ ok: boolean; error?: string; session?: WorkSession }> {
  const validation = validateSessionAction(input.action, input.reason);
  if (!validation.ok) return validation;

  const store = getOfflineStore();
  const active = await getActiveSessionForTechnician(input.technicianId);
  if (
    active &&
    active.workOrderId !== input.workOrderId &&
    input.action !== "COMPLETE_WORK"
  ) {
    // Starting another job while one is active
    if (
      ["BEGIN_TRAVEL", "ARRIVE_ON_SITE", "START_WORK", "RESUME_WORK"].includes(
        input.action,
      )
    ) {
      return {
        ok: false,
        error: `Active session on another work order (${active.workOrderId}). Complete or pause it first.`,
      };
    }
  }

  const session =
    (await getSessionForWorkOrder(input.workOrderId, input.technicianId)) ??
    ({
      id: newEntityId("wses"),
      workOrderId: input.workOrderId,
      technicianId: input.technicianId,
      technicianName: input.technicianName,
      active: false,
      events: [],
      travelStartedAt: null,
      arrivedAt: null,
      workStartedAt: null,
      completedAt: null,
      totalTravelMs: 0,
      totalLaborMs: 0,
      totalPausedMs: 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    } satisfies WorkSession);

  const at = input.at ?? nowIso();
  const event: WorkSessionEvent = {
    id: newEntityId("wse"),
    action: input.action,
    occurredAt: at,
    reason: input.reason?.trim() || null,
  };

  const events = [...session.events, event];
  let next: WorkSession = {
    ...session,
    events,
    updatedAt: at,
  };

  switch (input.action) {
    case "BEGIN_TRAVEL":
      next = {
        ...next,
        active: true,
        travelStartedAt: next.travelStartedAt ?? at,
      };
      break;
    case "ARRIVE_ON_SITE":
      next = {
        ...next,
        active: true,
        arrivedAt: at,
        totalTravelMs:
          next.totalTravelMs + msBetween(next.travelStartedAt, at),
      };
      break;
    case "START_WORK":
    case "RESUME_WORK":
      next = {
        ...next,
        active: true,
        workStartedAt: next.workStartedAt ?? at,
      };
      break;
    case "PAUSE_WORK":
    case "WAITING_FOR_PARTS":
    case "WAITING_FOR_CUSTOMER": {
      const lastStart = [...events]
        .reverse()
        .find((e) =>
          ["START_WORK", "RESUME_WORK", "ARRIVE_ON_SITE"].includes(e.action),
        );
      const pauseAdd = lastStart ? msBetween(lastStart.occurredAt, at) : 0;
      next = {
        ...next,
        active: true,
        totalLaborMs: next.totalLaborMs + (input.action === "PAUSE_WORK" ? 0 : 0),
        totalPausedMs:
          next.totalPausedMs + (input.action === "PAUSE_WORK" ? pauseAdd : 0),
      };
      if (input.action === "PAUSE_WORK") {
        // labor accrued until pause
        next.totalLaborMs += pauseAdd;
      }
      break;
    }
    case "COMPLETE_WORK": {
      const lastStart = [...events]
        .reverse()
        .find((e) =>
          ["START_WORK", "RESUME_WORK", "ARRIVE_ON_SITE"].includes(e.action),
        );
      next = {
        ...next,
        active: false,
        completedAt: at,
        totalLaborMs: next.totalLaborMs + (lastStart ? msBetween(lastStart.occurredAt, at) : 0),
      };
      break;
    }
  }

  // Deactivate other sessions for this tech when starting new active work
  if (next.active) {
    const all = await store.getAll<WorkSession & { id: string }>("sessions");
    for (const s of all) {
      if (s.technicianId === input.technicianId && s.id !== next.id && s.active) {
        await store.put("sessions", { ...s, active: false, updatedAt: at });
      }
    }
  }

  await store.put("sessions", next as WorkSession & { id: string });
  await appendFieldAudit({
    userId: input.technicianId,
    action: `SESSION_${input.action}`,
    entityType: "WorkSession",
    entityId: next.id,
    operationId: null,
    previousValue: null,
    newValue: input.action,
    syncStatus: null,
    error: null,
  });

  return { ok: true, session: next };
}

export function formatDurationMs(ms: number): string {
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}
