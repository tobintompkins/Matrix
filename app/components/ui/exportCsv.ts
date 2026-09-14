/**
 * Patch 52A.4 — safe client-side CSV export for currently loaded / filtered rows.
 * Labels should clarify "current filtered results" vs full database export.
 */

export type CsvColumn<T> = {
  key: string;
  header: string;
  value: (row: T) => string | number | boolean | null | undefined;
};

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function rowsToCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => escapeCsvCell(c.header)).join(",");
  const body = rows
    .map((row) =>
      columns
        .map((column) => {
          const raw = column.value(row);
          if (raw == null) return "";
          return escapeCsvCell(String(raw));
        })
        .join(","),
    )
    .join("\n");
  return `${header}\n${body}`;
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function exportRowsAsCsv<T>(
  filename: string,
  rows: T[],
  columns: CsvColumn<T>[],
): void {
  downloadCsv(filename, rowsToCsv(rows, columns));
}
