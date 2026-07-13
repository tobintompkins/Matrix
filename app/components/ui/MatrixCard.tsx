import type { ReactNode } from "react";
import { cn } from "./utils";

export type MatrixCardProps = {
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
  bodyClassName?: string;
  padding?: boolean;
};

export default function MatrixCard({
  title,
  subtitle,
  icon,
  children,
  actions,
  className,
  bodyClassName,
  padding = true,
}: MatrixCardProps) {
  const hasHeader = title || subtitle || icon || actions;

  return (
    <div
      className={cn(
        "rounded-xl border border-slate-800/90 bg-slate-900/80 shadow-sm shadow-black/10",
        className,
      )}
    >
      {hasHeader && (
        <div className="flex items-start justify-between gap-4 border-b border-slate-800/80 px-5 py-3.5 md:px-6">
          <div className="flex items-start gap-3">
            {icon && (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700/80 bg-slate-950/50 text-cyan-400">
                {icon}
              </div>
            )}
            <div>
              {title && (
                <h3 className="text-base font-semibold text-white md:text-lg">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
              )}
            </div>
          </div>
          {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn(padding && "p-5 md:p-6", bodyClassName)}>{children}</div>
    </div>
  );
}
