"use client";

import { useId, type ReactNode } from "react";
import { cn } from "./utils";
import MatrixButton from "./MatrixButton";
import MatrixSearchBar from "./MatrixSearchBar";

export type MatrixTableToolbarFilterOption = {
  value: string;
  label: string;
};

export type MatrixTableToolbarProps = {
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  statusFilter?: string;
  statusOptions?: MatrixTableToolbarFilterOption[];
  onStatusFilterChange?: (value: string) => void;
  secondaryFilters?: ReactNode;
  onExport?: () => void;
  exportLabel?: string;
  onClearFilters?: () => void;
  clearLabel?: string;
  actions?: ReactNode;
  compact?: boolean;
  className?: string;
};

/**
 * Compact table toolbar — search + filters aligned for list pages.
 */
export default function MatrixTableToolbar({
  searchPlaceholder = "Search…",
  searchValue,
  onSearchChange,
  statusFilter,
  statusOptions,
  onStatusFilterChange,
  secondaryFilters,
  onExport,
  exportLabel = "Export",
  onClearFilters,
  clearLabel = "Clear filters",
  actions,
  compact = true,
  className,
}: MatrixTableToolbarProps) {
  const searchId = useId();
  const showStatus =
    Array.isArray(statusOptions) &&
    statusOptions.length > 0 &&
    typeof onStatusFilterChange === "function";

  return (
    <div
      className={cn(
        "matrix-toolbar mb-4 flex flex-col gap-3 rounded-[var(--matrix-card-radius)] border shadow-[var(--matrix-shadow)]",
        compact ? "p-3 sm:p-3.5" : "p-4 md:p-5",
        className,
      )}
      style={{
        borderColor: "var(--matrix-border-subtle)",
        background: "var(--matrix-card-bg)",
      }}
    >
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        {onSearchChange && (
          <div className="min-w-0 flex-1 lg:max-w-xl">
            <MatrixSearchBar
              id={searchId}
              placeholder={searchPlaceholder}
              value={searchValue}
              onValueChange={onSearchChange}
              aria-label={searchPlaceholder}
              className={compact ? "[&_input]:py-2.5" : undefined}
            />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {showStatus && (
            <label className="flex items-center gap-2 text-sm text-[color:var(--matrix-muted)]">
              <span className="sr-only sm:not-sr-only">Status</span>
              <select
                value={statusFilter ?? ""}
                onChange={(event) => onStatusFilterChange?.(event.target.value)}
                className="rounded-xl border px-3 py-2 text-sm text-[color:var(--foreground)] focus:outline-none focus:ring-1"
                style={{
                  borderColor: "var(--matrix-border)",
                  background: "var(--matrix-surface-elevated)",
                }}
                aria-label="Filter by status"
              >
                <option value="">All statuses</option>
                {statusOptions!.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          {secondaryFilters}

          {onClearFilters && (
            <MatrixButton
              type="button"
              variant="secondary"
              size="sm"
              onClick={onClearFilters}
            >
              {clearLabel}
            </MatrixButton>
          )}

          {onExport && (
            <MatrixButton
              type="button"
              variant="secondary"
              size="sm"
              onClick={onExport}
            >
              {exportLabel}
            </MatrixButton>
          )}

          {actions}
        </div>
      </div>
    </div>
  );
}
