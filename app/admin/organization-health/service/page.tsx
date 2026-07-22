"use client";

import { OrganizationHealthDrilldownPage } from "../Drilldown";

export default function ServiceHealthDrilldown() {
  return (
    <OrganizationHealthDrilldownPage
      title="Service Operations Detail"
      category="service"
      permission="VIEW_SERVICE_HEALTH"
    />
  );
}
