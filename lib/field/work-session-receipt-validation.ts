const actions = new Set(["BEGIN_TRAVEL", "ARRIVE_ON_SITE", "START_WORK", "PAUSE_WORK", "RESUME_WORK", "WAITING_FOR_PARTS", "WAITING_FOR_CUSTOMER"]);
export function validateFieldWorkSessionReceipt(payload: Record<string, unknown>) {
  const action = typeof payload.action === "string" ? payload.action : "";
  return actions.has(action) ? { ok: true as const, action } : { ok: false as const, error: "Unsupported Field work-session action." };
}
