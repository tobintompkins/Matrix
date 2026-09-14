import Link from "next/link";
import type { ReactNode } from "react";
import MatrixStatusBadge, {
  type MatrixStatusVariant,
} from "@/app/components/ui/MatrixStatusBadge";
import { cn } from "@/app/components/ui/utils";
import { IconAlert, IconBell, IconClock } from "@/app/components/nav-icons";

export type AttentionSeverity = "critical" | "warning" | "informational";

export type AttentionItemProps = {
  title: string;
  description: string;
  href?: string;
  severity?: AttentionSeverity;
  statusLabel?: string;
  dueLabel?: string;
  actionLabel?: string;
  className?: string;
};

const severityStyles: Record<AttentionSeverity, string> = {
  critical: "border-rose-500/30 bg-rose-500/5",
  warning: "border-amber-500/30 bg-amber-500/5",
  informational: "border-slate-700/80 bg-slate-950/40",
};

const severityBadge: Record<AttentionSeverity, MatrixStatusVariant> = {
  critical: "critical",
  warning: "warning",
  informational: "neutral",
};

const severityLabel: Record<AttentionSeverity, string> = {
  critical: "Critical",
  warning: "Warning",
  informational: "Info",
};

function SeverityIcon({
  severity,
}: {
  severity: AttentionSeverity;
}): ReactNode {
  if (severity === "critical") {
    return <IconAlert className="h-4 w-4 text-rose-300" />;
  }
  if (severity === "warning") {
    return <IconClock className="h-4 w-4 text-amber-300" />;
  }
  return <IconBell className="h-4 w-4 text-slate-400" />;
}

/** Reusable attention-list row for Service Hub Attention Center. */
export default function AttentionItem({
  title,
  description,
  href,
  severity = "informational",
  statusLabel,
  dueLabel,
  actionLabel,
  className,
}: AttentionItemProps) {
  const content = (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border px-3 py-2.5 text-sm transition",
        severityStyles[severity],
        href && "hover:bg-slate-900/60",
        className,
      )}
    >
      <span
        className="mt-0.5 shrink-0"
        aria-hidden
        title={severityLabel[severity]}
      >
        <SeverityIcon severity={severity} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-slate-100">{title}</span>
          <MatrixStatusBadge
            variant={severityBadge[severity]}
            label={statusLabel ?? severityLabel[severity]}
          />
        </span>
        <span className="mt-0.5 block text-xs text-slate-400">{description}</span>
        {(dueLabel || actionLabel) && (
          <span className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-slate-500">
            {dueLabel ? <span>{dueLabel}</span> : null}
            {actionLabel ? (
              <span className="font-medium text-cyan-400">{actionLabel}</span>
            ) : null}
          </span>
        )}
      </span>
      <span className="sr-only">{severityLabel[severity]}</span>
    </div>
  );

  if (!href) return content;

  return (
    <Link
      href={href}
      className="block rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
    >
      {content}
    </Link>
  );
}
