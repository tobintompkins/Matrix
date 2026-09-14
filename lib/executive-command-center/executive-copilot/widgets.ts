/**
 * Patch 51C.3 — Executive dashboard widget catalog.
 * Maps named widgets to existing ECC surfaces — does not create a parallel dashboard.
 */

import type { ExecutiveDashboardWidgetDef } from "./types";

export const EXECUTIVE_DASHBOARD_WIDGETS: ExecutiveDashboardWidgetDef[] = [
  {
    key: "executiveSummary",
    title: "Executive Summary",
    description: "Overview KPIs, priorities, and AI briefing from Enterprise Intelligence.",
    href: "/executive-command-center",
    source: "overview",
  },
  {
    key: "fleetHealth",
    title: "Fleet Health",
    description: "Explainable fleet health score and machine risk.",
    href: "/executive-command-center/scorecards",
    source: "overview",
  },
  {
    key: "serviceTrends",
    title: "Service Trends",
    description: "Call volume, aging, and period comparisons.",
    href: "/executive-command-center/trends",
    source: "analytics",
  },
  {
    key: "customerHealth",
    title: "Customer Health",
    description: "Customer reliability and open-call pressure (executive-internal).",
    href: "/executive-command-center/customers",
    source: "analytics",
  },
  {
    key: "revenueDashboard",
    title: "Revenue Dashboard",
    description: "Revenue proxies from cost/activity scorecards when available.",
    href: "/executive-command-center/analytics",
    source: "analytics",
  },
  {
    key: "costDashboard",
    title: "Cost Dashboard",
    description: "Highest-cost machines and parts consumption widgets.",
    href: "/executive-command-center/widgets",
    source: "reporting",
  },
  {
    key: "inventoryHealth",
    title: "Inventory Health",
    description: "Stockouts, reorder pressure, and parts demand forecasts.",
    href: "/inventory",
    source: "reporting",
  },
  {
    key: "technicianPerformance",
    title: "Technician Performance",
    description: "Productivity, workload, and first-time fix proxies.",
    href: "/executive-command-center/technicians",
    source: "analytics",
  },
  {
    key: "aiInsights",
    title: "AI Insights",
    description: "Executive AI Copilot Ask — Matrix-data answers only.",
    href: "/executive-command-center/ai-insights",
    source: "overview",
  },
  {
    key: "forecastAlerts",
    title: "Forecast Alerts",
    description: "Predictive business alerts and machine risk warnings.",
    href: "/executive-command-center/predictive-analytics",
    source: "predictive",
  },
];

export function listExecutiveDashboardWidgets() {
  return EXECUTIVE_DASHBOARD_WIDGETS;
}
