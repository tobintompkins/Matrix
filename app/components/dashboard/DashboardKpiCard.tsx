import type { ReactNode } from "react";
import MatrixStatCard, {
  type MatrixStatCardProps,
} from "@/app/components/ui/MatrixStatCard";
import { cn } from "@/app/components/ui/utils";

export type DashboardKpiCardProps = MatrixStatCardProps & {
  loading?: boolean;
};

/** Service Hub KPI summary card — wraps MatrixStatCard with optional skeleton. */
export default function DashboardKpiCard({
  loading = false,
  className,
  ...props
}: DashboardKpiCardProps) {
  if (loading) {
    return (
      <div
        className={cn(
          "animate-pulse rounded-2xl border border-slate-800/90 bg-slate-900/80 p-5 md:p-6",
          className,
        )}
        aria-hidden
      >
        <div className="h-4 w-24 rounded bg-slate-800" />
        <div className="mt-4 h-8 w-16 rounded bg-slate-800" />
        <div className="mt-3 h-3 w-32 rounded bg-slate-800/80" />
      </div>
    );
  }

  return <MatrixStatCard className={className} {...props} />;
}

export type DashboardKpiCardListProps = {
  children: ReactNode;
  className?: string;
};

export function DashboardKpiCardRow({
  children,
  className,
}: DashboardKpiCardListProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4",
        className,
      )}
    >
      {children}
    </div>
  );
}
