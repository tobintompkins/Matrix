import type { ReactNode } from "react";
import { cn } from "./utils";

export type MatrixPageHeaderProps = {
  title: string;
  subtitle?: string;
  description?: string;
  breadcrumbs?: string[];
  actions?: ReactNode;
  className?: string;
};

/**
 * Standard in-page header — clear title, muted description, responsive actions.
 */
export default function MatrixPageHeader({
  title,
  subtitle,
  description,
  breadcrumbs,
  actions,
  className,
}: MatrixPageHeaderProps) {
  const supportingText = description ?? subtitle;

  return (
    <div className={cn("matrix-page-heading", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav
          aria-label="Breadcrumb"
          className="mb-2 flex flex-wrap items-center gap-2 text-xs text-[color:var(--matrix-muted)]"
        >
          {breadcrumbs.map((crumb, index) => (
            <span key={`${crumb}-${index}`} className="flex items-center gap-2">
              {index > 0 && <span aria-hidden>/</span>}
              <span
                className={
                  index === breadcrumbs.length - 1
                    ? "text-[color:var(--matrix-accent)]"
                    : undefined
                }
              >
                {crumb}
              </span>
            </span>
          ))}
        </nav>
      )}

      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <h2 className="matrix-page-title">{title}</h2>
          {supportingText && (
            <p className="matrix-muted mt-1.5 max-w-3xl">{supportingText}</p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
