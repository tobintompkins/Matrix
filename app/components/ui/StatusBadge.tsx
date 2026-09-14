import MatrixStatusBadge, {
  type MatrixStatusVariant,
  ticketStatusToVariant,
  fleetStatusToVariant,
} from "./MatrixStatusBadge";
import { cn } from "./utils";

export type StatusBadgeStatus =
  | "Open"
  | "In Progress"
  | "Waiting"
  | "Waiting Parts"
  | "Completed"
  | "Healthy"
  | "Warning"
  | "Critical"
  | "Overdue"
  | string;

export type StatusBadgeProps = {
  status: StatusBadgeStatus;
  label?: string;
  className?: string;
};

const STATUS_TO_VARIANT: Record<string, MatrixStatusVariant> = {
  Open: "open",
  "In Progress": "in-progress",
  Waiting: "waiting",
  "Waiting Parts": "waiting-parts",
  Completed: "completed",
  Healthy: "healthy",
  Warning: "warning",
  Critical: "critical",
  Overdue: "overdue",
};

/**
 * Patch 52A.3 — convenient status badge that accepts display labels directly.
 * Reuses MatrixStatusBadge + shared semantic variants.
 */
export default function StatusBadge({
  status,
  label,
  className,
}: StatusBadgeProps) {
  const normalized = status.trim();
  const variant = statusToVariant(normalized);

  return (
    <MatrixStatusBadge
      variant={variant}
      label={label ?? normalized}
      className={cn(className)}
    />
  );
}

export function statusToVariant(status: string): MatrixStatusVariant {
  if (STATUS_TO_VARIANT[status]) return STATUS_TO_VARIANT[status];
  const ticket = ticketStatusToVariant(status);
  if (ticket !== "offline") return ticket;
  return fleetStatusToVariant(status);
}
