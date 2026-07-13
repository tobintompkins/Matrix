import type { ReactNode } from "react";
import { cn } from "./utils";

export type MatrixInfoPanelProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export default function MatrixInfoPanel({
  title,
  subtitle,
  children,
  footer,
  className,
}: MatrixInfoPanelProps) {
  return (
    <aside
      className={cn(
        "rounded-xl border border-slate-800/90 bg-slate-900/80 p-5 shadow-sm shadow-black/10 md:p-6",
        className,
      )}
    >
      <div className="mb-4">
        <h3 className="text-base font-semibold text-white md:text-lg">{title}</h3>
        {subtitle && (
          <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
        )}
      </div>
      <div>{children}</div>
      {footer && (
        <div className="mt-5 border-t border-slate-800/80 pt-4">{footer}</div>
      )}
    </aside>
  );
}
