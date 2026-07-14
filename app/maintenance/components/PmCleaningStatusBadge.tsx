"use client";

import { MatrixStatusBadge, type MatrixStatusVariant } from "../../components/ui";
import type { PmCleaningStatus } from "@/lib/maintenance/pm-status";
import { PM_STATUS_DISPLAY_LABELS } from "@/lib/maintenance/pm-status";

function statusToVariant(status: PmCleaningStatus): MatrixStatusVariant {
  switch (status) {
    case "GOOD":
      return "completed";
    case "DUE_SOON":
      return "warning";
    case "DUE":
      return "waiting-parts";
    case "OVERDUE":
      return "error";
    case "NOT_CONFIGURED":
    default:
      return "offline";
  }
}

/** Patch 45 PM cleaning status badge — text + color (not color alone). */
export default function PmCleaningStatusBadge({
  status,
}: {
  status: PmCleaningStatus;
}) {
  return (
    <MatrixStatusBadge
      variant={statusToVariant(status)}
      label={PM_STATUS_DISPLAY_LABELS[status]}
    />
  );
}
