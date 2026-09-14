import type { ReactNode } from "react";
import AppCard from "./AppCard";
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
  footer?: ReactNode;
};

/**
 * Matrix card — now built on AppCard (Patch 52A.3) for shared theme tokens.
 */
export default function MatrixCard({
  title,
  subtitle,
  icon,
  children,
  actions,
  className,
  bodyClassName,
  padding = true,
  footer,
}: MatrixCardProps) {
  return (
    <AppCard
      title={title}
      description={subtitle}
      icon={icon}
      actions={actions}
      footer={footer}
      className={className}
      bodyClassName={bodyClassName}
      padding={padding}
    >
      {children}
    </AppCard>
  );
}

/** Compact inline helper for card title rows without a full AppCard. */
export function MatrixCardChrome({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--matrix-card-radius)] border shadow-[var(--matrix-shadow)]",
        className,
      )}
      style={{
        borderColor: "var(--matrix-border-subtle)",
        background: "var(--matrix-card-bg)",
      }}
    >
      {children}
    </div>
  );
}
