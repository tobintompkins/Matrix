"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import MatrixEmptyState from "./MatrixEmptyState";
import MatrixSearchBar from "./MatrixSearchBar";
import MatrixStatusBadge, {
  type MatrixStatusVariant,
} from "./MatrixStatusBadge";
import { cn } from "./utils";

export type MatrixTableColumn<T> = {
  key: string;
  header: string;
  sortable?: boolean;
  className?: string;
  render?: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
};

export type MatrixTableStatusConfig<T> = {
  columnKey: string;
  getVariant: (row: T) => MatrixStatusVariant;
  getLabel: (row: T) => string;
  getClassName?: (row: T) => string | undefined;
};

export type MatrixTableProps<T extends Record<string, unknown>> = {
  columns: MatrixTableColumn<T>[];
  data: T[];
  rowKey: (row: T, index: number) => string;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchKeys?: string[];
  paginated?: boolean;
  pageSize?: number;
  pageSizeOptions?: number[];
  onPageSizeChange?: (size: number) => void;
  visibleColumnKeys?: string[];
  statusConfig?: MatrixTableStatusConfig<T>;
  emptyTitle?: string;
  emptyDescription?: string;
  stickyHeader?: boolean;
  compact?: boolean;
  toolbar?: ReactNode;
  className?: string;
};

type SortState = {
  key: string;
  direction: "asc" | "desc";
} | null;

function getCellValue<T extends Record<string, unknown>>(
  row: T,
  key: string,
): string {
  const value = row[key];
  if (value == null) return "";
  return String(value);
}

export default function MatrixTable<T extends Record<string, unknown>>({
  columns,
  data,
  rowKey,
  searchable = true,
  searchPlaceholder = "Search table…",
  searchKeys,
  paginated = true,
  pageSize: pageSizeProp = 10,
  pageSizeOptions = [10, 25, 50, 100],
  onPageSizeChange,
  visibleColumnKeys,
  statusConfig,
  emptyTitle = "No records found",
  emptyDescription = "Try adjusting your search or filters.",
  stickyHeader = true,
  compact = false,
  toolbar,
  className,
}: MatrixTableProps<T>) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortState>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(pageSizeProp);

  useEffect(() => {
    setPageSize(pageSizeProp);
  }, [pageSizeProp]);

  const visibleColumns = useMemo(() => {
    if (!visibleColumnKeys || visibleColumnKeys.length === 0) return columns;
    const allowed = new Set(visibleColumnKeys);
    return columns.filter((column) => allowed.has(column.key));
  }, [columns, visibleColumnKeys]);

  const keysToSearch = searchKeys ?? visibleColumns.map((column) => column.key);

  const filteredData = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return data;

    return data.filter((row) =>
      keysToSearch.some((key) =>
        getCellValue(row, key).toLowerCase().includes(query),
      ),
    );
  }, [data, keysToSearch, search]);

  const sortedData = useMemo(() => {
    if (!sort) return filteredData;

    const column = visibleColumns.find((item) => item.key === sort.key);
    if (!column) return filteredData;

    return [...filteredData].sort((left, right) => {
      const leftValue = column.sortValue
        ? column.sortValue(left)
        : getCellValue(left, column.key);
      const rightValue = column.sortValue
        ? column.sortValue(right)
        : getCellValue(right, column.key);

      if (typeof leftValue === "number" && typeof rightValue === "number") {
        return sort.direction === "asc"
          ? leftValue - rightValue
          : rightValue - leftValue;
      }

      return sort.direction === "asc"
        ? String(leftValue).localeCompare(String(rightValue))
        : String(rightValue).localeCompare(String(leftValue));
    });
  }, [visibleColumns, filteredData, sort]);

  const totalPages = paginated
    ? Math.max(1, Math.ceil(sortedData.length / pageSize))
    : 1;
  const currentPage = Math.min(page, totalPages);

  const pagedData = paginated
    ? sortedData.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : sortedData;

  function toggleSort(key: string) {
    setPage(1);
    setSort((current) => {
      if (!current || current.key !== key) {
        return { key, direction: "asc" };
      }
      if (current.direction === "asc") {
        return { key, direction: "desc" };
      }
      return null;
    });
  }

  const cellPad = compact ? "px-3 py-2.5 md:px-4" : "px-4 py-3 md:px-5";

  return (
    <div className={cn("space-y-3", className)}>
      {(searchable || toolbar) && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {searchable && (
            <div className="min-w-0 flex-1 sm:max-w-md">
              <MatrixSearchBar
                id="matrix-table-search"
                placeholder={searchPlaceholder}
                value={search}
                onValueChange={(value) => {
                  setSearch(value);
                  setPage(1);
                }}
              />
            </div>
          )}
          {toolbar ? (
            <div className="flex flex-wrap items-center gap-2">{toolbar}</div>
          ) : null}
        </div>
      )}

      <div
        className="overflow-x-auto rounded-[var(--matrix-card-radius)] border"
        style={{ borderColor: "var(--matrix-border-subtle)" }}
      >
        <table className="min-w-full text-left text-sm">
          <thead
            className={cn(
              "border-b text-[color:var(--matrix-muted)]",
              stickyHeader && "sticky top-0 z-10",
            )}
            style={{
              borderColor: "var(--matrix-border-subtle)",
              background: "var(--matrix-surface-elevated)",
            }}
          >
            <tr>
              {visibleColumns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    "whitespace-nowrap text-xs font-semibold uppercase tracking-wide",
                    cellPad,
                    column.className,
                  )}
                >
                  {column.sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(column.key)}
                      aria-label={`Sort by ${column.header}`}
                      className="inline-flex items-center gap-2 rounded hover:text-[color:var(--matrix-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
                    >
                      {column.header}
                      <span className="text-xs opacity-60" aria-hidden>
                        {sort?.key === column.key
                          ? sort.direction === "asc"
                            ? "↑"
                            : "↓"
                          : "↕"}
                      </span>
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pagedData.map((row, index) => (
              <tr
                key={rowKey(row, index)}
                className="border-t text-[color:var(--foreground)] transition hover:bg-slate-900/40"
                style={{ borderColor: "var(--matrix-border-subtle)" }}
              >
                {visibleColumns.map((column) => {
                  if (
                    statusConfig &&
                    column.key === statusConfig.columnKey
                  ) {
                    return (
                      <td
                        key={column.key}
                        className={cn(cellPad, column.className)}
                      >
                        <MatrixStatusBadge
                          variant={statusConfig.getVariant(row)}
                          label={statusConfig.getLabel(row)}
                          className={statusConfig.getClassName?.(row)}
                        />
                      </td>
                    );
                  }

                  return (
                    <td
                      key={column.key}
                      className={cn(cellPad, column.className)}
                    >
                      {column.render
                        ? column.render(row)
                        : getCellValue(row, column.key)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {pagedData.length === 0 && (
          <div
            className="border-t p-6"
            style={{ borderColor: "var(--matrix-border-subtle)" }}
          >
            <MatrixEmptyState
              title={emptyTitle}
              description={emptyDescription}
            />
          </div>
        )}
      </div>

      {paginated && sortedData.length > 0 && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-sm text-[color:var(--matrix-muted)] sm:px-4"
          style={{
            borderColor: "var(--matrix-border-subtle)",
            background: "var(--matrix-surface-elevated)",
          }}
        >
          <div className="flex flex-wrap items-center gap-3">
            <p>
              Showing {(currentPage - 1) * pageSize + 1}–
              {Math.min(currentPage * pageSize, sortedData.length)} of{" "}
              {sortedData.length}
            </p>
            {pageSizeOptions.length > 0 && (
              <label className="flex items-center gap-2">
                <span className="sr-only">Rows per page</span>
                <select
                  className="rounded-lg border border-slate-700 bg-transparent px-2 py-1 text-sm"
                  value={pageSize}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    setPageSize(next);
                    setPage(1);
                    onPageSizeChange?.(next);
                  }}
                  aria-label="Rows per page"
                >
                  {pageSizeOptions.map((size) => (
                    <option key={size} value={size}>
                      {size} / page
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              className="rounded-lg border border-slate-700 px-3 py-1.5 enabled:hover:bg-slate-800 disabled:opacity-40"
              aria-label="Previous page"
            >
              Previous
            </button>
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() =>
                setPage((value) => Math.min(totalPages, value + 1))
              }
              className="rounded-lg border border-slate-700 px-3 py-1.5 enabled:hover:bg-slate-800 disabled:opacity-40"
              aria-label="Next page"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
