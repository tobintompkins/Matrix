import { validateWholeNonNegativeCount } from "@/lib/maintenance/calculations";

const kinds = new Set(["PM", "CLEANING", "JOINT_UNIT", "DTF_PM"]);

export function validateFieldMaintenanceReceipt(payload: Record<string, unknown>) {
  const kind = typeof payload.kind === "string" ? payload.kind : "";
  const count = validateWholeNonNegativeCount(Number(payload.copyCount));
  if (!kinds.has(kind)) return { ok: false as const, error: "Unsupported maintenance type." };
  if (!count.ok) return count;
  if (payload.checklistComplete !== true) return { ok: false as const, error: "Maintenance checklist must be complete." };
  return { ok: true as const, kind: kind as "PM" | "CLEANING" | "JOINT_UNIT" | "DTF_PM", copyCount: count.value, workPerformed: typeof payload.workPerformed === "string" ? payload.workPerformed.trim() : "", notes: typeof payload.notes === "string" ? payload.notes.trim() : "" };
}
