/**
 * Patch 50C-2 — Server-side log redaction (never rely on UI hiding alone).
 */

const SENSITIVE_KEY =
  /password|passwd|pwd|token|secret|apikey|api[_-]?key|authorization|cookie|session|refresh|oauth|private[_-]?key|signing|invitation|ssn|social.?security|card.?number|cvv|iban|account.?number|bearer/i;

const SENSITIVE_VALUE =
  /bearer\s+[a-z0-9._\-]+|eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/i;

export function redactValue(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "string") {
    if (SENSITIVE_VALUE.test(value)) return "[REDACTED]";
    if (value.length > 4000) return `${value.slice(0, 4000)}…[TRUNCATED]`;
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map(redactValue);
  if (typeof value === "object") {
    return redactObject(value as Record<string, unknown>);
  }
  return "[REDACTED]";
}

export function redactObject(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (SENSITIVE_KEY.test(key)) {
      out[key] = "[SECRET]";
      continue;
    }
    out[key] = redactValue(value);
  }
  return out;
}

export function redactPayloadJson(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return JSON.stringify(redactValue(parsed));
  } catch {
    if (SENSITIVE_VALUE.test(raw)) return "[REDACTED]";
    return raw.length > 2000 ? `${raw.slice(0, 2000)}…[TRUNCATED]` : raw;
  }
}

export function redactStackTrace(stack: string | null | undefined): string | null {
  if (!stack) return null;
  return stack
    .split("\n")
    .slice(0, 40)
    .map((line) => line.replace(SENSITIVE_VALUE, "[REDACTED]"))
    .join("\n");
}
