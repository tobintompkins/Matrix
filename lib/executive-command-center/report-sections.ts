/**
 * Patch 51C.1 — Configurable report builder section registry.
 */

export const ENTERPRISE_REPORT_SECTION_OPTIONS = [
  { key: "service", label: "Service operations", defaultOn: true },
  { key: "pm", label: "Preventive maintenance", defaultOn: true },
  { key: "predictive", label: "Predictive risk", defaultOn: true },
  { key: "decisions", label: "Decision engine", defaultOn: true },
  { key: "ai", label: "AI insights", defaultOn: true },
  { key: "customers", label: "Customer reliability", defaultOn: true },
  { key: "partsConsumption", label: "Parts consumption", defaultOn: true },
  {
    key: "technicianProductivity",
    label: "Technician productivity",
    defaultOn: true,
  },
  { key: "organizationHealth", label: "Organization health", defaultOn: true },
  { key: "fleetHealth", label: "Fleet health", defaultOn: true },
  {
    key: "predictiveBusiness",
    label: "Predictive business analytics",
    defaultOn: true,
  },
  {
    key: "executiveCopilot",
    label: "Executive AI Copilot",
    defaultOn: true,
  },
] as const;

export type EnterpriseReportSectionKey =
  (typeof ENTERPRISE_REPORT_SECTION_OPTIONS)[number]["key"];

export function defaultReportSections(): string[] {
  return ENTERPRISE_REPORT_SECTION_OPTIONS.filter((s) => s.defaultOn).map(
    (s) => s.key,
  );
}
