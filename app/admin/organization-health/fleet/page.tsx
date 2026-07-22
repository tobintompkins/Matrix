"use client";

import { OrganizationHealthDrilldownPage } from "../Drilldown";

export default function FleetHealthDrilldown() {
  return (
    <OrganizationHealthDrilldownPage
      title="Fleet Health Detail"
      category="fleet"
      permission="VIEW_FLEET_HEALTH"
    />
  );
}
