import type { ReactNode } from "react";
import { cn } from "./utils";

export type AppCardProps = {
  children?: ReactNode;
  header?: ReactNode;
  body?: ReactNode;
  footer?: ReactNode;
  title?: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
  padding?: boolean;
  as?: "div" | "aside" | "section";
};

/**
 * Patch 52A.3 — reusable modern card with header / body / footer slots.
 * Theme-aware via CSS variables (--matrix-*).
 */
export default function AppCard({
  children,
  header,
  body,
  footer,
  title,
  description,
  icon,
  actions,
  className,
  headerClassName,
  bodyClassName,
  footerClassName,
  padding = true,
  as = "div",
}: AppCardProps) {
  const Root = as;
  const composedHeader =
    header ??
    (title || description || icon || actions ? (
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          {icon ? (
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-[color:var(--matrix-accent)]"
              style={{
                borderColor: "var(--matrix-border)",
                background: "var(--matrix-surface-elevated)",
              }}
            >
              {icon}
            </div>
          ) : null}
          <div className="min-w-0">
            {title ? <h3 className="matrix-section-title">{title}</h3> : null}
            {description ? (
              <p className="matrix-muted mt-1">{description}</p>
            ) : null}
          </div>
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
        ) : null}
      </div>
    ) : null);

  const bodyContent = body ?? children;

  return (
    <Root
      className={cn(
        "matrix-card overflow-hidden rounded-[var(--matrix-card-radius)] border shadow-[var(--matrix-shadow)]",
        className,
      )}
      style={{
        borderColor: "var(--matrix-border-subtle)",
        background: "var(--matrix-card-bg)",
      }}
    >
      {composedHeader ? (
        <div
          className={cn(
            "border-b px-4 py-3.5 sm:px-5 md:px-6 md:py-4",
            headerClassName,
          )}
          style={{ borderColor: "var(--matrix-border-subtle)" }}
        >
          {composedHeader}
        </div>
      ) : null}

      {bodyContent != null ? (
        <div
          className={cn(
            padding && "p-4 sm:p-5 md:p-6",
            bodyClassName,
          )}
        >
          {bodyContent}
        </div>
      ) : null}

      {footer != null ? (
        <div
          className={cn(
            "border-t px-4 py-3 sm:px-5 md:px-6",
            footerClassName,
          )}
          style={{ borderColor: "var(--matrix-border-subtle)" }}
        >
          {footer}
        </div>
      ) : null}
    </Root>
  );
}
