"use client";

import { useEffect, useState, type ReactNode } from "react";
import MatrixButton from "./MatrixButton";
import MatrixSearchBar from "./MatrixSearchBar";
import { cn } from "./utils";
import type { ColumnVisibilityOption } from "./useColumnVisibility";

export type EnterpriseFilterOption = {
  value: string;
  label: string;
};

export type EnterpriseSelectFilter = {
  id: string;
  label: string;
  value: string;
  options: EnterpriseFilterOption[];
  onChange: (value: string) => void;
  /** When true, empty string means "all" and is shown as first option. */
  allLabel?: string;
};

export type EnterpriseTextFilter = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "date";
};

export type EnterpriseTableToolbarProps = {
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  /** Debounce ms for search callbacks (0 = immediate). */
  searchDebounceMs?: number;
  selectFilters?: EnterpriseSelectFilter[];
  textFilters?: EnterpriseTextFilter[];
  secondaryFilters?: ReactNode;
  activeFilterLabels?: string[];
  resultCount?: number;
  resultLabel?: string;
  onClearFilters?: () => void;
  clearLabel?: string;
  onExport?: () => void;
  exportLabel?: string;
  columnOptions?: ColumnVisibilityOption[];
  visibleColumnKeys?: string[];
  onToggleColumn?: (key: string) => void;
  bulkActions?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

/**
 * Patch 52A.4 — reusable enterprise table toolbar.
 * Pages only pass the controls they need; unused slots stay hidden.
 */
export default function EnterpriseTableToolbar({
  searchPlaceholder = "Search…",
  searchValue = "",
  onSearchChange,
  searchDebounceMs = 200,
  selectFilters = [],
  textFilters = [],
  secondaryFilters,
  activeFilterLabels = [],
  resultCount,
  resultLabel = "results",
  onClearFilters,
  clearLabel = "Clear filters",
  onExport,
  exportLabel = "Export CSV (filtered)",
  columnOptions,
  visibleColumnKeys,
  onToggleColumn,
  bulkActions,
  actions,
  className,
}: EnterpriseTableToolbarProps) {
  const [localSearch, setLocalSearch] = useState(searchValue);
  const [columnsOpen, setColumnsOpen] = useState(false);

  useEffect(() => {
    setLocalSearch(searchValue);
  }, [searchValue]);

  useEffect(() => {
    if (!onSearchChange) return;
    if (searchDebounceMs <= 0) {
      if (localSearch !== searchValue) onSearchChange(localSearch);
      return;
    }
    const handle = window.setTimeout(() => {
      if (localSearch !== searchValue) onSearchChange(localSearch);
    }, searchDebounceMs);
    return () => window.clearTimeout(handle);
  }, [localSearch, onSearchChange, searchDebounceMs, searchValue]);

  const controlClass =
    "w-full rounded-xl border px-3 py-2 text-sm text-[color:var(--foreground)] focus:outline-none focus:ring-1 focus:ring-cyan-500";
  const controlStyle = {
    borderColor: "var(--matrix-border)",
    background: "var(--matrix-surface-elevated)",
  } as const;

  return (
    <div
      className={cn(
        "mb-4 space-y-3 rounded-[var(--matrix-card-radius)] border p-3 shadow-[var(--matrix-shadow)] sm:p-4",
        className,
      )}
      style={{
        borderColor: "var(--matrix-border-subtle)",
        background: "var(--matrix-card-bg)",
      }}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        {onSearchChange && (
          <div className="relative min-w-0 flex-1">
            <MatrixSearchBar
              id="enterprise-table-search"
              placeholder={searchPlaceholder}
              value={localSearch}
              onValueChange={setLocalSearch}
              aria-label={searchPlaceholder}
              className="[&_input]:py-2.5"
            />
            {localSearch ? (
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs text-[color:var(--matrix-muted)] hover:text-[color:var(--foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
                onClick={() => {
                  setLocalSearch("");
                  onSearchChange("");
                }}
                aria-label="Clear search"
              >
                Clear
              </button>
            ) : null}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {typeof resultCount === "number" && (
            <p className="text-sm text-[color:var(--matrix-muted)]">
              <span className="font-semibold text-[color:var(--foreground)]">
                {resultCount}
              </span>{" "}
              {resultLabel}
            </p>
          )}

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

          {columnOptions && onToggleColumn && (
            <div className="relative">
              <MatrixButton
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setColumnsOpen((open) => !open)}
                aria-expanded={columnsOpen}
                aria-haspopup="true"
              >
                Columns
              </MatrixButton>
              {columnsOpen && (
                <div
                  className="absolute right-0 z-20 mt-2 w-56 rounded-xl border p-2 shadow-lg"
                  style={{
                    borderColor: "var(--matrix-border)",
                    background: "var(--matrix-surface)",
                  }}
                  role="menu"
                >
                  <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--matrix-muted)]">
                    Visible columns
                  </p>
                  <ul className="max-h-64 space-y-1 overflow-y-auto">
                    {columnOptions.map((option) => {
                      const checked =
                        visibleColumnKeys?.includes(option.key) ?? true;
                      return (
                        <li key={option.key}>
                          <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-800/60">
                            <input
                              type="checkbox"
                              className="rounded border-slate-600"
                              checked={checked}
                              disabled={option.locked}
                              onChange={() => onToggleColumn(option.key)}
                              aria-label={`Toggle ${option.label} column`}
                            />
                            <span>
                              {option.label}
                              {option.locked ? (
                                <span className="ml-1 text-xs text-[color:var(--matrix-muted)]">
                                  (required)
                                </span>
                              ) : null}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}

          {actions}
        </div>
      </div>

      {(selectFilters.length > 0 || textFilters.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {selectFilters.map((filter) => (
            <label key={filter.id} className="block text-sm">
              <span className="mb-1 block text-[color:var(--matrix-muted)]">
                {filter.label}
              </span>
              <select
                className={controlClass}
                style={controlStyle}
                value={filter.value}
                onChange={(event) => filter.onChange(event.target.value)}
                aria-label={filter.label}
              >
                {filter.allLabel != null && (
                  <option value="">{filter.allLabel}</option>
                )}
                {filter.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
          {textFilters.map((filter) => (
            <label key={filter.id} className="block text-sm">
              <span className="mb-1 block text-[color:var(--matrix-muted)]">
                {filter.label}
              </span>
              <input
                type={filter.type ?? "text"}
                className={controlClass}
                style={controlStyle}
                value={filter.value}
                onChange={(event) => filter.onChange(event.target.value)}
                placeholder={filter.placeholder}
                aria-label={filter.label}
              />
            </label>
          ))}
        </div>
      )}

      {secondaryFilters}

      {activeFilterLabels.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" aria-live="polite">
          <span className="text-xs font-semibold uppercase tracking-wide text-[color:var(--matrix-muted)]">
            Active
          </span>
          {activeFilterLabels.map((label) => (
            <span
              key={label}
              className="inline-flex rounded-full bg-cyan-500/10 px-2.5 py-1 text-xs font-medium text-cyan-200 ring-1 ring-cyan-500/30"
            >
              {label}
            </span>
          ))}
        </div>
      )}

      {bulkActions ? (
        <div className="border-t border-slate-800/80 pt-3">{bulkActions}</div>
      ) : null}
    </div>
  );
}

/** Aliases preferred by some patches — re-exported from ui/index. */
