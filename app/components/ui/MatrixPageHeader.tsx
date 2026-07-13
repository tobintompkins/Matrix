import type { ReactNode } from "react";
import { cn } from "./utils";

export type MatrixPageHeaderProps = {
  title: string;
  subtitle?: string;
  breadcrumbs?: string[];
  actions?: ReactNode;
  className?: string;
};

export default function MatrixPageHeader({
  title,
  subtitle,
  breadcrumbs,
  actions,
  className,
}: MatrixPageHeaderProps) {
  return (
    <div className={cn("mb-6 md:mb-8", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav
          aria-label="Breadcrumb"
          className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-500"
        >
          {breadcrumbs.map((crumb, index) => (
            <span key={`${crumb}-${index}`} className="flex items-center gap-2">
              {index > 0 && <span aria-hidden>/</span>}
              <span
                className={
                  index === breadcrumbs.length - 1
                    ? "text-cyan-400"
                    : "text-slate-500"
                }
              >
                {crumb}
              </span>
            </span>
          ))}
        </nav>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight text-white md:text-2xl">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-slate-400">
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
    </div>
  );
}
