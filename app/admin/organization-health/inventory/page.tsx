"use client";

import { OrganizationHealthDrilldownPage } from "../Drilldown";

export default function InventoryHealthDrilldown() {
  return (
    <OrganizationHealthDrilldownPage
      title="Inventory Health Detail"
      category="inventory"
      permission="VIEW_INVENTORY_HEALTH"
    />
  );
}
