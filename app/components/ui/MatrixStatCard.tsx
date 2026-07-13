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
  accent = "text-white",
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
          <p className="text-sm text-slate-400">{label}</p>
        </div>
        {icon && (
          <div className="text-slate-500" aria-hidden>
            {icon}
          </div>
        )}
      </div>
      <p className={cn("mt-3 text-3xl font-semibold tracking-tight", accent)}>
        {value}
      </p>
      {trend && <p className="mt-2 text-xs text-slate-500">{trend}</p>}
    </>
  );

  const shell = cn(
    "rounded-xl border border-slate-800/90 bg-slate-900/80 p-5 shadow-sm shadow-black/10 transition",
    href &&
      "hover:border-slate-700 hover:bg-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400",
    className,
  );

  if (href) {
    return (
      <Link href={href} className={cn(shell, "block")}>
        {body}
      </Link>
    );
  }

  return <div className={shell}>{body}</div>;
}
