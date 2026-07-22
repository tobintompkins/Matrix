"use client";

import { OrganizationHealthDrilldownPage } from "../Drilldown";

export default function PmHealthDrilldown() {
  return (
    <OrganizationHealthDrilldownPage
      title="PM Compliance Detail"
      category="pm"
      permission="VIEW_PM_HEALTH"
    />
  );
}
