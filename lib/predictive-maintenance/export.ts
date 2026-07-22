/**
 * Patch 51A.3 — Export helpers for predictive data (CSV).
 */

export function predictiveRowsToCsv(
  headers: string[],
  rows: Array<Record<string, unknown>>,
): string {
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(","));
  }
  return lines.join("\n");
}
