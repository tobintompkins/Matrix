"use client";

import { useMemo, useState, type ReactNode } from "react";
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
  statusConfig?: MatrixTableStatusConfig<T>;
  emptyTitle?: string;
  emptyDescription?: string;
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
  pageSize = 5,
  statusConfig,
  emptyTitle = "No records found",
  emptyDescription = "Try adjusting your search or filters.",
  className,
}: MatrixTableProps<T>) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortState>(null);
  const [page, setPage] = useState(1);

  const keysToSearch = searchKeys ?? columns.map((column) => column.key);

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

    const column = columns.find((item) => item.key === sort.key);
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
  }, [columns, filteredData, sort]);

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

  return (
    <div className={cn("space-y-4", className)}>
      {searchable && (
        <MatrixSearchBar
          id="matrix-table-search"
          placeholder={searchPlaceholder}
          value={search}
          onValueChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
        />
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-800/90">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-800 bg-slate-950 text-slate-300">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    "whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide md:px-5",
                    column.className,
                  )}
                >
                  {column.sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(column.key)}
                      className="inline-flex items-center gap-2 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 hover:text-cyan-300"
                    >
                      {column.header}
                      <span className="text-xs text-slate-500" aria-hidden>
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
                className="border-t border-slate-800/80 text-slate-200 transition hover:bg-slate-900/50"
              >
                {columns.map((column) => {
                  if (
                    statusConfig &&
                    column.key === statusConfig.columnKey
                  ) {
                    return (
                      <td
                        key={column.key}
                        className={cn("px-4 py-3 md:px-5", column.className)}
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
                      className={cn("px-4 py-3 md:px-5", column.className)}
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
          <div className="border-t border-slate-800 p-6">
            <MatrixEmptyState
              title={emptyTitle}
              description={emptyDescription}
            />
          </div>
        )}
      </div>

      {paginated && sortedData.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-3 text-sm text-slate-400">
          <p>
            Showing {(currentPage - 1) * pageSize + 1}–
            {Math.min(currentPage * pageSize, sortedData.length)} of{" "}
            {sortedData.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-slate-300 enabled:hover:bg-slate-800 disabled:opacity-40"
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
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-slate-300 enabled:hover:bg-slate-800 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
