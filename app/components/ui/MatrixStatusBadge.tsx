import { cn } from "./utils";

export type MatrixStatusVariant =
  | "active"
  | "warning"
  | "error"
  | "completed"
  | "waiting-parts"
  | "offline";

export type MatrixStatusBadgeProps = {
  variant: MatrixStatusVariant;
  label?: string;
  className?: string;
};

const variantStyles: Record<MatrixStatusVariant, string> = {
  active: "bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/30",
  warning: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30",
  error: "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30",
  completed: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30",
  "waiting-parts":
    "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30",
  offline: "bg-slate-700/50 text-slate-400 ring-1 ring-slate-600",
};

const variantLabels: Record<MatrixStatusVariant, string> = {
  active: "Active",
  warning: "Warning",
  error: "Error",
  completed: "Completed",
  "waiting-parts": "Waiting Parts",
  offline: "Offline",
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

export function ticketStatusToVariant(
  status: string,
): MatrixStatusVariant {
  switch (status) {
    case "Open":
      return "active";
    case "In Progress":
      return "warning";
    case "Waiting Parts":
      return "waiting-parts";
    case "Completed":
      return "completed";
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
      return "completed";
    case "PM Due":
      return "warning";
    case "Attention":
      return "error";
    case "In Service":
      return "active";
    default:
      return "offline";
  }
}

export function fleetStatusBadgeClassName(status: string): string | undefined {
  if (status === "In Service") {
    return "bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/30";
  }
  if (status === "Online") {
    return "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30";
  }
  if (status === "PM Due") {
    return "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30";
  }
  if (status === "Attention") {
    return "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30";
  }
  return undefined;
}

export function customerStatusToVariant(status: string): MatrixStatusVariant {
  switch (status) {
    case "Active":
      return "completed";
    case "Pending":
      return "warning";
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
      return "completed";
    case "Low Stock":
      return "warning";
    case "On Order":
      return "active";
    case "Critical":
      return "error";
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
