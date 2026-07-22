/**
 * Patch 51A.5 Part 2 — Date range helpers for executive analytics.
 */

export type ExecutiveAnalyticsRange =
  | "TODAY"
  | "LAST_7"
  | "LAST_30"
  | "LAST_90"
  | "QTD"
  | "YTD";

export const EXECUTIVE_RANGE_OPTIONS: Array<{
  value: ExecutiveAnalyticsRange;
  label: string;
}> = [
  { value: "TODAY", label: "Today" },
  { value: "LAST_7", label: "Last 7 days" },
  { value: "LAST_30", label: "Last 30 days" },
  { value: "LAST_90", label: "Last 90 days" },
  { value: "QTD", label: "Quarter to date" },
  { value: "YTD", label: "Year to date" },
];

export function parseExecutiveRange(
  raw: string | null | undefined,
): ExecutiveAnalyticsRange {
  const v = (raw ?? "LAST_30").toUpperCase();
  if (
    v === "TODAY" ||
    v === "LAST_7" ||
    v === "LAST_30" ||
    v === "LAST_90" ||
    v === "QTD" ||
    v === "YTD"
  ) {
    return v;
  }
  return "LAST_30";
}

export function rangeToDays(range: ExecutiveAnalyticsRange): number {
  if (range === "TODAY") return 1;
  if (range === "LAST_7") return 7;
  if (range === "LAST_30") return 30;
  if (range === "LAST_90") return 90;
  if (range === "QTD") {
    const now = new Date();
    const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    return Math.max(1, Math.ceil((Date.now() - qStart.getTime()) / 86_400_000));
  }
  const now = new Date();
  const yStart = new Date(now.getFullYear(), 0, 1);
  return Math.max(1, Math.ceil((Date.now() - yStart.getTime()) / 86_400_000));
}

export function rangeStartDate(range: ExecutiveAnalyticsRange): Date {
  const days = rangeToDays(range);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (range === "TODAY") return start;
  if (range === "QTD") {
    return new Date(start.getFullYear(), Math.floor(start.getMonth() / 3) * 3, 1);
  }
  if (range === "YTD") {
    return new Date(start.getFullYear(), 0, 1);
  }
  start.setDate(start.getDate() - (days - 1));
  return start;
}

export function isIsoInRange(iso: string, range: ExecutiveAnalyticsRange): boolean {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return t >= rangeStartDate(range).getTime();
}
