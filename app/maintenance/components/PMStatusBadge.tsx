"use client";

import { MatrixStatusBadge } from "../../components/ui";
import {
  intelligenceStatusToVariant,
  type PmIntelligenceStatus,
} from "@/lib/pm-intelligence";

export default function PMStatusBadge({
  status,
}: {
  status: PmIntelligenceStatus;
}) {
  return (
    <MatrixStatusBadge
      variant={intelligenceStatusToVariant(status)}
      label={status}
    />
  );
}
