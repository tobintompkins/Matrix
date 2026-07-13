"use client";

import { useMemo } from "react";
import CustomerMaintenanceSummaryCard from "./CustomerMaintenanceSummaryCard";
import {
  buildCustomerMaintenanceSummary,
  listAllMaintenanceCompletions,
  listMaintenanceProfiles,
} from "@/lib/maintenance";

type Props = {
  customerName: string;
};

export default function CustomerMaintenanceSummarySection({
  customerName,
}: Props) {
  const summary = useMemo(() => {
    const profiles = listMaintenanceProfiles();
    const completions = listAllMaintenanceCompletions();
    return buildCustomerMaintenanceSummary(
      customerName,
      profiles,
      completions,
    );
  }, [customerName]);

  return <CustomerMaintenanceSummaryCard summary={summary} />;
}
