export function validateFieldTimeEntryReceipt(payload: Record<string, unknown>) {
  const hours = Number(payload.hours);
  if (!Number.isFinite(hours) || hours <= 0 || hours > 24) return { ok: false as const, error: "Time entry hours must be greater than 0 and no more than 24." };
  return { ok: true as const, hours: Math.round(hours * 100) / 100, note: typeof payload.note === "string" ? payload.note.trim() : "" };
}
