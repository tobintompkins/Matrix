import { cn } from "./utils";

export type MatrixStatusVariant =
  | "active"
  | "open"
  | "in-progress"
  | "waiting"
  | "waiting-parts"
  | "warning"
  | "error"
  | "critical"
  | "overdue"
  | "completed"
  | "healthy"
  | "offline"
  | "neutral";

export type MatrixStatusBadgeProps = {
  variant: MatrixStatusVariant;
  label?: string;
  className?: string;
};

const variantStyles: Record<MatrixStatusVariant, string> = {
  active: "bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/30",
  open: "bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/30",
  "in-progress": "bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/30",
  waiting: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30",
  "waiting-parts": "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30",
  warning: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30",
  error: "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30",
  critical: "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30",
  overdue: "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30",
  completed: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30",
  healthy: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30",
  offline: "bg-slate-700/50 text-slate-400 ring-1 ring-slate-600",
  neutral: "bg-slate-700/40 text-slate-300 ring-1 ring-slate-600/80",
};

const variantLabels: Record<MatrixStatusVariant, string> = {
  active: "Active",
  open: "Open",
  "in-progress": "In Progress",
  waiting: "Waiting",
  "waiting-parts": "Waiting Parts",
  warning: "Warning",
  error: "Error",
  critical: "Critical",
  overdue: "Overdue",
  completed: "Completed",
  healthy: "Healthy",
  offline: "Offline",
  neutral: "Info",
};

export default function MatrixStatusBadge({
  variant,
  label,
  className,
}: MatrixStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-3 py-1 text-xs font-semibold",
        variantStyles[variant],
        className,
      )}
    >
      {label ?? variantLabels[variant]}
    </span>
  );
}

export function ticketStatusToVariant(status: string): MatrixStatusVariant {
  switch (status) {
    case "Open":
      return "open";
    case "In Progress":
      return "in-progress";
    case "Waiting":
    case "Waiting Parts":
      return "waiting-parts";
    case "Completed":
      return "completed";
    case "Overdue":
      return "overdue";
    default:
      return "offline";
  }
}

export function ticketStatusBadgeClassName(status: string): string | undefined {
  if (status === "In Progress") {
    return "bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/30";
  }
  if (status === "Paused") {
    return "bg-slate-500/15 text-slate-300 ring-1 ring-slate-500/30";
  }
  return undefined;
}

export function fleetStatusToVariant(status: string): MatrixStatusVariant {
  switch (status) {
    case "Online":
    case "Healthy":
      return "healthy";
    case "PM Due":
    case "Warning":
      return "warning";
    case "Attention":
    case "Critical":
      return "critical";
    case "In Service":
      return "in-progress";
    case "Overdue":
      return "overdue";
    default:
      return "offline";
  }
}

export function fleetStatusBadgeClassName(status: string): string | undefined {
  if (status === "In Service") {
    return "bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/30";
  }
  if (status === "Online" || status === "Healthy") {
    return "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30";
  }
  if (status === "PM Due" || status === "Warning") {
    return "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30";
  }
  if (status === "Attention" || status === "Critical" || status === "Overdue") {
    return "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30";
  }
  return undefined;
}

export function customerStatusToVariant(status: string): MatrixStatusVariant {
  switch (status) {
    case "Active":
      return "healthy";
    case "Pending":
      return "waiting";
    case "Inactive":
      return "offline";
    default:
      return "offline";
  }
}

export function customerStatusBadgeClassName(
  status: string,
): string | undefined {
  if (status === "Active") {
    return "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30";
  }
  if (status === "Pending") {
    return "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30";
  }
  if (status === "Inactive") {
    return "bg-slate-500/15 text-slate-300 ring-1 ring-slate-500/30";
  }
  return undefined;
}

export function inventoryStatusToVariant(status: string): MatrixStatusVariant {
  switch (status) {
    case "In Stock":
      return "healthy";
    case "Low Stock":
      return "warning";
    case "On Order":
      return "open";
    case "Critical":
      return "critical";
    default:
      return "offline";
  }
}

export function inventoryStatusBadgeClassName(
  status: string,
): string | undefined {
  if (status === "In Stock") {
    return "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30";
  }
  if (status === "Low Stock") {
    return "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30";
  }
  if (status === "On Order") {
    return "bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/30";
  }
  if (status === "Critical") {
    return "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30";
  }
  return undefined;
}
