/**
 * Patch 50A — comment / text sanitization (no HTML execution).
 */

const MAX_COMMENT_LENGTH = 4000;
const MAX_TITLE_LENGTH = 200;
const MAX_TEXT_LENGTH = 8000;

export function sanitizePlainText(
  input: unknown,
  maxLength = MAX_TEXT_LENGTH,
): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim()
    .slice(0, maxLength);
}

export function sanitizeCommentBody(input: unknown): string {
  return sanitizePlainText(input, MAX_COMMENT_LENGTH);
}

export function sanitizeTitle(input: unknown): string {
  return sanitizePlainText(input, MAX_TITLE_LENGTH);
}

export function assertNonEmpty(value: string, field: string): void {
  if (!value.trim()) {
    throw new Error(`${field} is required.`);
  }
}
