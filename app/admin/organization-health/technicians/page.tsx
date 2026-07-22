"use client";

import { OrganizationHealthDrilldownPage } from "../Drilldown";

export default function TechnicianHealthDrilldown() {
  return (
    <OrganizationHealthDrilldownPage
      title="Technician Productivity Detail"
      category="technicians"
      permission="VIEW_TECHNICIAN_PRODUCTIVITY"
    />
  );
}
