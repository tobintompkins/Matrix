import { validateWholeNonNegativeCount } from "@/lib/maintenance/calculations";

export function validateFieldCopyCountReceipt(payload: Record<string, unknown>) {
  const count = validateWholeNonNegativeCount(Number(payload.copyCount));
  if (!count.ok) return count;
  const lowerCountReason = typeof payload.lowerCountReason === "string" ? payload.lowerCountReason.trim() : "";
  const note = typeof payload.note === "string" ? payload.note.trim() : "";
  return { ok: true as const, copyCount: count.value, lowerCountReason, note };
}
