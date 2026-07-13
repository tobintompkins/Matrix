"use client";

import Link from "next/link";
import { MatrixCard } from "../../components/ui";

export default function PMDashboardCard({
  label,
  value,
  href,
}: {
  label: string;
  value: string | number;
  href?: string;
}) {
  const content = (
    <MatrixCard className={href ? "transition hover:ring-1 hover:ring-cyan-500/40" : undefined}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-3xl font-bold text-slate-100">{value}</p>
    </MatrixCard>
  );
  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    );
  }
  return content;
}
