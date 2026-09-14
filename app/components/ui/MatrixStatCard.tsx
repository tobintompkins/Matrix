import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "./utils";

export type MatrixStatCardProps = {
  label: string;
  value: ReactNode;
  accent?: string;
  icon?: ReactNode;
  trend?: string;
  href?: string;
  status?: "neutral" | "ok" | "watch" | "attention" | "unavailable";
  className?: string;
};

const statusDot: Record<
  NonNullable<MatrixStatCardProps["status"]>,
  string
> = {
  neutral: "bg-slate-500",
  ok: "bg-emerald-500/80",
  watch: "bg-amber-500/80",
  attention: "bg-rose-500/70",
  unavailable: "bg-slate-600",
};

export default function MatrixStatCard({
  label,
  value,
  accent = "text-[color:var(--foreground)]",
  icon,
  trend,
  href,
  status = "neutral",
  className,
}: MatrixStatCardProps) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={cn("mt-0.5 h-1.5 w-1.5 rounded-full", statusDot[status])}
            aria-hidden
          />
          <p className="matrix-muted text-sm">{label}</p>
        </div>
        {icon && (
          <div className="text-[color:var(--matrix-muted)]" aria-hidden>
            {icon}
          </div>
        )}
      </div>
      <p className={cn("mt-3 text-3xl font-semibold tracking-tight", accent)}>
        {value}
      </p>
      {trend && <p className="matrix-muted mt-2 text-xs">{trend}</p>}
    </>
  );

  const shell = cn(
    "rounded-[var(--matrix-card-radius)] border p-4 shadow-[var(--matrix-shadow)] transition sm:p-5 md:p-6",
    href &&
      "hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400",
    className,
  );

  const style = {
    borderColor: "var(--matrix-border-subtle)",
    background: "var(--matrix-card-bg)",
  } as const;

  if (href) {
    return (
      <Link href={href} className={cn(shell, "block")} style={style}>
        {body}
      </Link>
    );
  }

  return (
    <div className={shell} style={style}>
      {body}
    </div>
  );
}
