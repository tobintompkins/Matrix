"use client";

import { MatrixCard } from "../../components/ui";

export default function InventoryAnalyticsCard({
  title,
  value,
  subtitle,
  children,
}: {
  title: string;
  value?: string | number;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <MatrixCard>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </p>
      {value != null ? (
        <p className="mt-2 text-2xl font-semibold text-slate-100">{value}</p>
      ) : null}
      {subtitle ? <p className="mt-1 text-sm text-slate-400">{subtitle}</p> : null}
      {children ? <div className="mt-3">{children}</div> : null}
    </MatrixCard>
  );
}
