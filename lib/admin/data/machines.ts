/**
 * Patch 49B — Machine administrative operations (digital twin overlay).
 */

import { digitalTwinFleet, getDigitalTwinMachine } from "@/lib/digital-twin";
import type { DigitalTwinMachine, MachineStatus } from "@/lib/digital-twin/types";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import { listServiceCalls } from "@/lib/service-calls";
import { validateDeletionReason } from "./deletion-reasons";
import { getRelationshipImpact } from "./relationship-impact";
import {
  archiveOperationalRecord,
  getOperationalState,
  restoreOperationalRecord,
  softDeleteOperationalRecord,
  unarchiveOperationalRecord,
  upsertOperationalState,
} from "./operational-state";
import type { AdminRecordLifecycle, DeletionReasonKey } from "./types";

const MACHINE_META_KEY = "matrix.admin.machine-meta.v1";

export type MachineAdminMeta = {
  machineId: string;
  nickname?: string;
  customerName?: string;
  siteName?: string;
  serialNumber?: string;
  printerModel?: string;
  status?: MachineStatus;
  department?: string;
  floor?: string;
  retiredAt?: string | null;
  updatedAtVersion: number;
  updatedAt: string;
};

let machineMetaStore: Record<string, MachineAdminMeta> | null = null;

function readMeta(): Record<string, MachineAdminMeta> {
  if (machineMetaStore) return machineMetaStore;
  if (typeof window !== "undefined") {
    try {
      const raw = window.sessionStorage.getItem(MACHINE_META_KEY);
      if (raw) {
        machineMetaStore = JSON.parse(raw) as Record<string, MachineAdminMeta>;
        return machineMetaStore;
      }
    } catch {
      /* ignore */
    }
  }
  machineMetaStore = {};
  return machineMetaStore;
}

function writeMeta(next: Record<string, MachineAdminMeta>) {
  machineMetaStore = next;
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(MACHINE_META_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export type AdminMachineRow = {
  machineId: string;
  nickname: string;
  serialNumber: string;
  printerModel: string;
  customerName: string;
  siteName: string;
  status: MachineStatus;
  region: string;
  technician: string;
  recordState: AdminRecordLifecycle;
  retiredAt: string | null;
  updatedAtVersion: number;
};

function toRow(machine: DigitalTwinMachine): AdminMachineRow {
  const meta = readMeta()[machine.identity.machineId];
  const state = getOperationalState("MACHINE", machine.identity.machineId);
  return {
    machineId: machine.identity.machineId,
    nickname: meta?.nickname ?? machine.identity.nickname,
    serialNumber: meta?.serialNumber ?? machine.identity.serialNumber,
    printerModel: meta?.printerModel ?? machine.identity.printerModel,
    customerName: meta?.customerName ?? machine.location.customerName,
    siteName: meta?.siteName ?? machine.location.siteName,
    status: meta?.status ?? machine.operational.status,
    region: machine.assignment.assignedRegion,
    technician: machine.assignment.assignedTechnician,
    recordState: state?.lifecycle ?? "ACTIVE",
    retiredAt: meta?.retiredAt ?? null,
    updatedAtVersion: meta?.updatedAtVersion ?? state?.updatedAtVersion ?? 1,
  };
}

export function listAdminMachines(input: {
  search?: string;
  recordState?: "ACTIVE" | "ARCHIVED" | "DELETED" | "ALL" | "RETIRED";
  page?: number;
  pageSize?: number;
}): { items: AdminMachineRow[]; total: number; page: number; pageSize: number } {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 20));
  let rows = digitalTwinFleet.map(toRow);

  const recordState = input.recordState ?? "ACTIVE";
  if (recordState === "DELETED") {
    rows = rows.filter((r) => r.recordState === "DELETED");
  } else if (recordState === "ARCHIVED") {
    rows = rows.filter((r) => r.recordState === "ARCHIVED");
  } else if (recordState === "RETIRED") {
    rows = rows.filter(
      (r) => r.status === "RETIRED" && r.recordState !== "DELETED",
    );
  } else if (recordState === "ACTIVE") {
    rows = rows.filter(
      (r) => r.recordState === "ACTIVE" && r.status !== "RETIRED",
    );
  }

  const q = input.search?.trim().toLowerCase() ?? "";
  if (q) {
    rows = rows.filter((r) =>
      [
        r.machineId,
        r.nickname,
        r.serialNumber,
        r.printerModel,
        r.customerName,
        r.siteName,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }

  rows = [...rows].sort((a, b) => a.nickname.localeCompare(b.nickname));
  const total = rows.length;
  const start = (page - 1) * pageSize;
  return {
    items: rows.slice(start, start + pageSize),
    total,
    page,
    pageSize,
  };
}

export type AdminMachineActor = {
  userId: string;
  displayName: string;
  organizationId?: string;
};

export function updateMachineAsAdmin(
  machineId: string,
  patch: Partial<
    Pick<
      MachineAdminMeta,
      | "nickname"
      | "customerName"
      | "siteName"
      | "serialNumber"
      | "printerModel"
      | "status"
      | "department"
      | "floor"
    >
  > & { expectedVersion?: number },
  actor: AdminMachineActor,
  reason: string,
): { ok: true; row: AdminMachineRow } | { ok: false; error: string } {
  const machine = getDigitalTwinMachine(machineId);
  if (!machine) return { ok: false, error: "Machine not found." };
  const actorOrg = actor.organizationId ?? DEFAULT_ORG_ID;
  const state = getOperationalState("MACHINE", machineId);
  if (state?.organizationId && state.organizationId !== actorOrg) {
    return { ok: false, error: "Cross-organization edit is not allowed." };
  }
  if (state?.lifecycle === "DELETED") {
    return {
      ok: false,
      error: "Deleted machines must be restored before editing.",
    };
  }
  const existing = readMeta()[machineId];
  if (
    patch.expectedVersion != null &&
    (existing?.updatedAtVersion ?? 1) !== patch.expectedVersion
  ) {
    return {
      ok: false,
      error:
        "This record changed after you opened it. Refresh and review the latest information before continuing.",
    };
  }
  if (reason.trim().length < 3) {
    return { ok: false, error: "A reason for change is required." };
  }

  const nextSerial = patch.serialNumber?.trim();
  if (nextSerial && nextSerial !== (existing?.serialNumber ?? machine.identity.serialNumber)) {
    const conflict = digitalTwinFleet.some((other) => {
      if (other.identity.machineId === machineId) return false;
      const otherState = getOperationalState("MACHINE", other.identity.machineId);
      if (otherState?.lifecycle === "DELETED" || otherState?.lifecycle === "ARCHIVED") {
        return false;
      }
      const otherMeta = readMeta()[other.identity.machineId];
      const otherSerial = otherMeta?.serialNumber ?? other.identity.serialNumber;
      return otherSerial === nextSerial;
    });
    if (conflict) {
      return {
        ok: false,
        error:
          "Serial number conflicts with another active machine. Document an authorized exception before forcing a duplicate.",
      };
    }
  }

  const nextMeta: MachineAdminMeta = {
    machineId,
    nickname: patch.nickname ?? existing?.nickname,
    customerName: patch.customerName ?? existing?.customerName,
    siteName: patch.siteName ?? existing?.siteName,
    serialNumber: patch.serialNumber ?? existing?.serialNumber,
    printerModel: patch.printerModel ?? existing?.printerModel,
    status: patch.status ?? existing?.status,
    department: patch.department ?? existing?.department,
    floor: patch.floor ?? existing?.floor,
    retiredAt:
      patch.status === "RETIRED"
        ? new Date().toISOString()
        : (existing?.retiredAt ?? null),
    updatedAtVersion: (existing?.updatedAtVersion ?? 1) + 1,
    updatedAt: new Date().toISOString(),
  };
  writeMeta({ ...readMeta(), [machineId]: nextMeta });
  void actor;
  return { ok: true, row: toRow(machine) };
}

export function retireMachine(
  machineId: string,
  actor: AdminMachineActor,
  reason: string,
): { ok: true; row: AdminMachineRow } | { ok: false; error: string } {
  return updateMachineAsAdmin(
    machineId,
    { status: "RETIRED" },
    actor,
    reason,
  );
}

export function archiveMachine(
  machineId: string,
  actor: AdminMachineActor,
  reason: string,
): { ok: true; row: AdminMachineRow } | { ok: false; error: string } {
  const machine = getDigitalTwinMachine(machineId);
  if (!machine) return { ok: false, error: "Machine not found." };
  if (!reason.trim()) {
    return { ok: false, error: "Archive reason is required." };
  }
  const actorOrg = actor.organizationId ?? DEFAULT_ORG_ID;
  const existingState = getOperationalState("MACHINE", machineId);
  if (existingState?.organizationId && existingState.organizationId !== actorOrg) {
    return { ok: false, error: "Cross-organization archive is not allowed." };
  }
  const overlay = archiveOperationalRecord({
    recordType: "MACHINE",
    recordId: machineId,
    actorUserId: actor.userId,
    actorName: actor.displayName,
    reason,
    organizationId: actorOrg,
    displayName: machine.identity.nickname,
    customerName: machine.location.customerName,
    machineName: machine.identity.serialNumber,
  });
  if (!overlay.ok) return overlay;
  return { ok: true, row: toRow(machine) };
}

export function softDeleteMachine(
  machineId: string,
  actor: AdminMachineActor,
  input: {
    reason: DeletionReasonKey | string;
    notes?: string | null;
    confirmPhrase: string;
  },
): { ok: true; row: AdminMachineRow } | { ok: false; error: string } {
  const machine = getDigitalTwinMachine(machineId);
  if (!machine) return { ok: false, error: "Machine not found." };
  const reasonCheck = validateDeletionReason(input.reason, input.notes);
  if (!reasonCheck.ok) return reasonCheck;
  const expected = `DELETE ${machine.identity.serialNumber || machineId}`;
  if (input.confirmPhrase.trim() !== expected) {
    return { ok: false, error: `Type ${expected} to confirm deletion.` };
  }
  const impact = getRelationshipImpact("MACHINE", machineId);
  if (!impact.canSoftDelete) {
    return {
      ok: false,
      error:
        impact.blockers[0] ??
        "This machine cannot be deleted because service history exists.",
    };
  }
  const overlay = softDeleteOperationalRecord({
    recordType: "MACHINE",
    recordId: machineId,
    actorUserId: actor.userId,
    actorName: actor.displayName,
    reason: input.reason,
    notes: input.notes,
    organizationId: actor.organizationId ?? DEFAULT_ORG_ID,
    displayName: machine.identity.nickname,
    customerName: machine.location.customerName,
    machineName: machine.identity.serialNumber,
  });
  if (!overlay.ok) return overlay;
  return { ok: true, row: toRow(machine) };
}

export function restoreMachine(
  machineId: string,
  actor: AdminMachineActor,
  reason?: string,
): { ok: true; row: AdminMachineRow } | { ok: false; error: string } {
  const machine = getDigitalTwinMachine(machineId);
  if (!machine) return { ok: false, error: "Machine not found." };
  if (!reason || reason.trim().length < 3) {
    return { ok: false, error: "A restoration reason is required." };
  }
  const state = getOperationalState("MACHINE", machineId);
  if (!state || state.lifecycle === "ACTIVE") {
    return { ok: false, error: "This machine is not archived or deleted." };
  }
  const actorOrg = actor.organizationId ?? DEFAULT_ORG_ID;
  if (state.organizationId && state.organizationId !== actorOrg) {
    return { ok: false, error: "Cross-organization restore is not allowed." };
  }

  const meta = readMeta()[machineId];
  const serial = meta?.serialNumber ?? machine.identity.serialNumber;
  const serialConflict = digitalTwinFleet.some((other) => {
    if (other.identity.machineId === machineId) return false;
    const otherState = getOperationalState("MACHINE", other.identity.machineId);
    if (otherState?.lifecycle === "DELETED" || otherState?.lifecycle === "ARCHIVED") {
      return false;
    }
    const otherMeta = readMeta()[other.identity.machineId];
    const otherSerial = otherMeta?.serialNumber ?? other.identity.serialNumber;
    return otherSerial === serial;
  });
  if (serialConflict) {
    return {
      ok: false,
      error:
        "Restore failed: serial number conflicts with another active machine.",
    };
  }

  if (state.lifecycle === "DELETED") {
    const overlay = restoreOperationalRecord({
      recordType: "MACHINE",
      recordId: machineId,
      actorUserId: actor.userId,
      actorName: actor.displayName,
      reason,
    });
    if (!overlay.ok) return overlay;
  } else {
    const overlay = unarchiveOperationalRecord({
      recordType: "MACHINE",
      recordId: machineId,
      actorUserId: actor.userId,
      actorName: actor.displayName,
    });
    if (!overlay.ok) return overlay;
  }
  upsertOperationalState({
    recordType: "MACHINE",
    recordId: machineId,
    lifecycle: "ACTIVE",
    organizationId: actorOrg,
    displayName: machine.identity.nickname,
    updatedAtVersion: 0,
  });
  return { ok: true, row: toRow(machine) };
}

export function findMachineDuplicateCandidates(machineId: string): Array<{
  candidateId: string;
  candidateName: string;
  signals: string[];
  recommendedAction: string;
}> {
  const machine = getDigitalTwinMachine(machineId);
  if (!machine) return [];
  const results: Array<{
    candidateId: string;
    candidateName: string;
    signals: string[];
    recommendedAction: string;
  }> = [];
  for (const other of digitalTwinFleet) {
    if (other.identity.machineId === machineId) continue;
    const otherState = getOperationalState("MACHINE", other.identity.machineId);
    if (otherState?.lifecycle === "DELETED") continue;
    const signals: string[] = [];
    if (other.identity.serialNumber === machine.identity.serialNumber) {
      signals.push("Same serial number");
    }
    if (
      other.location.customerName === machine.location.customerName &&
      other.identity.printerModel === machine.identity.printerModel
    ) {
      signals.push("Same customer and model");
    }
    if (
      other.identity.assetTag &&
      machine.identity.assetTag &&
      other.identity.assetTag === machine.identity.assetTag
    ) {
      signals.push("Same asset number");
    }
    if (signals.length > 0) {
      results.push({
        candidateId: other.identity.machineId,
        candidateName: other.identity.nickname,
        signals,
        recommendedAction:
          "Review candidates. Automatic machine merge is not supported.",
      });
    }
  }
  return results;
}

/** Active machines for operational workflows — excludes deleted/archived. */
export function isMachineVisibleInOperations(machineId: string): boolean {
  const state = getOperationalState("MACHINE", machineId);
  if (state?.lifecycle === "DELETED" || state?.lifecycle === "ARCHIVED") {
    return false;
  }
  return true;
}

export function listMachineServiceHistory(machineId: string) {
  return listServiceCalls({ includeDeleted: false }).filter(
    (c) => c.machine.machineId === machineId,
  );
}
