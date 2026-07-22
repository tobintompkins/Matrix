/**
 * Patch 51A.5 Part 3 — Export engine (CSV / Excel XML / PDF text).
 * Matches maintenance export approach — no new PDF/XLSX dependencies.
 */

import type {
  ExecutiveExportFormat,
  PeriodReportBundle,
} from "./reporting-types";

function escapeCsv(value: string | number | null | undefined): string {
  const raw = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildExecutiveReportCsv(bundle: PeriodReportBundle): string {
  const lines = [
    "section,key,label,value,detail",
    `meta,period,${escapeCsv(bundle.period)},${escapeCsv(bundle.periodLabel)},`,
    `meta,generatedAt,${escapeCsv(bundle.generatedAt)},,`,
    `meta,window,${escapeCsv(bundle.window.start)},${escapeCsv(bundle.window.end)},`,
    ...bundle.scorecards.map(
      (s) =>
        `scorecard,${escapeCsv(s.key)},${escapeCsv(s.label)},${escapeCsv(s.value)},${escapeCsv(s.detail)}`,
    ),
    ...bundle.comparisons.map(
      (c) =>
        `comparison,${escapeCsv(c.metric)},current=${c.current},previous=${c.previous},delta=${c.delta}`,
    ),
    ...bundle.highlights.map(
      (h, i) => `highlight,h${i},${escapeCsv(h)},,`,
    ),
    `ai,summary,${escapeCsv(bundle.aiSummary.summary)},sample=${bundle.aiSummary.isSample},`,
  ];
  return lines.join("\n");
}

export function buildExecutiveReportExcelXml(bundle: PeriodReportBundle): string {
  const rows = [
    ["Section", "Key", "Label", "Value", "Detail"],
    ["meta", "period", bundle.period, bundle.periodLabel, ""],
    ["meta", "generatedAt", bundle.generatedAt, "", ""],
    ...bundle.scorecards.map((s) => [
      "scorecard",
      s.key,
      s.label,
      s.value == null ? "n/a" : String(s.value),
      s.detail,
    ]),
    ...bundle.comparisons.map((c) => [
      "comparison",
      c.metric,
      String(c.current),
      String(c.previous),
      `delta ${c.delta}`,
    ]),
  ];
  const xmlRows = rows
    .map(
      (cols) =>
        `<Row>${cols
          .map((c) => `<Cell><Data ss:Type="String">${escapeXml(String(c))}</Data></Cell>`)
          .join("")}</Row>`,
    )
    .join("");
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="ExecutiveReport">
  <Table>${xmlRows}</Table>
 </Worksheet>
</Workbook>`;
}

export function buildExecutiveReportPdfText(bundle: PeriodReportBundle): string {
  const lines = [
    "MATRIX EXECUTIVE REPORT",
    bundle.periodLabel,
    `Generated: ${bundle.generatedAt}`,
    `Window: ${bundle.window.start} → ${bundle.window.end}`,
    "",
    "AI EXECUTIVE SUMMARY",
    bundle.aiSummary.summary,
    "",
    "KPI SCORECARDS",
    ...bundle.scorecards.map(
      (s) =>
        `- ${s.label}: ${s.available ? String(s.value) : "unavailable"} (${s.status}) — ${s.detail}`,
    ),
    "",
    "TREND COMPARISON",
    ...bundle.comparisons.map(
      (c) =>
        `- ${c.metric}: ${c.previous} → ${c.current} (${c.direction}, delta ${c.delta})`,
    ),
    "",
    "HIGHLIGHTS",
    ...bundle.highlights.map((h) => `- ${h}`),
    "",
    "(PDF text export — open in any viewer; print to PDF from browser if needed.)",
  ];
  return lines.join("\n");
}

export function exportExecutiveReport(
  bundle: PeriodReportBundle,
  format: ExecutiveExportFormat,
): { filename: string; mime: string; content: string } {
  const stamp = new Date().toISOString().slice(0, 10);
  const base = `matrix-executive-${bundle.period.toLowerCase()}-${stamp}`;
  if (format === "csv") {
    return {
      filename: `${base}.csv`,
      mime: "text/csv;charset=utf-8",
      content: buildExecutiveReportCsv(bundle),
    };
  }
  if (format === "excel") {
    return {
      filename: `${base}.xls`,
      mime: "application/vnd.ms-excel",
      content: buildExecutiveReportExcelXml(bundle),
    };
  }
  return {
    filename: `${base}.txt`,
    mime: "application/pdf",
    content: buildExecutiveReportPdfText(bundle),
  };
}
