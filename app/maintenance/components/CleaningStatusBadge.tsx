"use client";

import { MatrixStatusBadge } from "../../components/ui";
import type { CleaningStatus } from "@/lib/pm-intelligence";

function variantFor(status: CleaningStatus) {
  switch (status) {
    case "Current":
    case "Completed":
      return "completed" as const;
    case "Due Soon":
    case "Scheduled":
      return "warning" as const;
    case "Due":
    case "Overdue":
      return "error" as const;
    default:
      return "offline" as const;
  }
}

export default function CleaningStatusBadge({
  status,
}: {
  status: CleaningStatus;
}) {
  return <MatrixStatusBadge variant={variantFor(status)} label={status} />;
}
