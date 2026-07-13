import type { ReactNode } from "react";
import { cn } from "./utils";
import MatrixButton from "./MatrixButton";

export type MatrixEmptyStateProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
  className?: string;
};

export default function MatrixEmptyState({
  title,
  description,
  icon,
  actionLabel,
  onAction,
  actionHref,
  className,
}: MatrixEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-950/40 px-6 py-16 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="mb-4 text-5xl text-slate-700" aria-hidden>
          {icon}
        </div>
      ) : (
        <div
          className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-2xl text-slate-600"
          aria-hidden
        >
          ∅
        </div>
      )}
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      {description && (
        <p className="mt-2 max-w-md text-sm text-slate-400">{description}</p>
      )}
      {actionLabel && (actionHref || onAction) && (
        <div className="mt-6">
          {actionHref ? (
            <MatrixButton href={actionHref} variant="primary" size="md">
              {actionLabel}
            </MatrixButton>
          ) : (
            <MatrixButton variant="primary" size="md" onClick={onAction}>
              {actionLabel}
            </MatrixButton>
          )}
        </div>
      )}
    </div>
  );
}
