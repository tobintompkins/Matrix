"use client";

import { OrganizationHealthDrilldownPage } from "../Drilldown";

export default function CustomerHealthDrilldown() {
  return (
    <OrganizationHealthDrilldownPage
      title="Customer Health Detail"
      category="customers"
      permission="VIEW_CUSTOMER_HEALTH"
    />
  );
}
