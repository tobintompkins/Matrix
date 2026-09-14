import type { ReactNode } from "react";
import AppCard from "@/app/components/ui/AppCard";
import { cn } from "@/app/components/ui/utils";

export type DashboardSectionCardProps = {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  footer?: ReactNode;
  loading?: boolean;
};

/** Reusable Service Hub section card with optional loading skeleton. */
export default function DashboardSectionCard({
  title,
  subtitle,
  icon,
  actions,
  children,
  className,
  bodyClassName,
  footer,
  loading = false,
}: DashboardSectionCardProps) {
  if (loading) {
    return (
      <div
        className={cn(
          "animate-pulse rounded-[var(--matrix-card-radius)] border shadow-[var(--matrix-shadow)]",
          className,
        )}
        style={{
          borderColor: "var(--matrix-border-subtle)",
          background: "var(--matrix-card-bg)",
        }}
        aria-busy="true"
        aria-label={`Loading ${title}`}
      >
        <div
          className="border-b px-5 py-4 md:px-6"
          style={{ borderColor: "var(--matrix-border-subtle)" }}
        >
          <div className="h-5 w-40 rounded bg-slate-800" />
          <div className="mt-2 h-3 w-56 rounded bg-slate-800/80" />
        </div>
        <div className="space-y-3 p-5 md:p-6">
          <div className="h-10 rounded bg-slate-800/70" />
          <div className="h-10 rounded bg-slate-800/70" />
          <div className="h-10 rounded bg-slate-800/50" />
        </div>
      </div>
    );
  }

  return (
    <AppCard
      title={title}
      description={subtitle}
      icon={icon}
      actions={actions}
      footer={footer}
      className={className}
      bodyClassName={bodyClassName}
    >
      {children}
    </AppCard>
  );
}
