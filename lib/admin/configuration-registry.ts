/**
 * Patch 49A — configuration registry for System Configuration.
 */

export type AdminConfigurationDefinition = {
  key: string;
  label: string;
  description?: string;
  permission: "MANAGE_SYSTEM_CONFIGURATION";
  scope: "ORGANIZATION";
  configurationType: string;
  supportsOrdering?: boolean;
  supportsDeactivation?: boolean;
  protectedValues?: string[];
};

export const CONFIGURATION_REGISTRY: AdminConfigurationDefinition[] = [
  {
    key: "service_call_priorities",
    label: "Service Call Priorities",
    description: "Priority options for new service calls.",
    permission: "MANAGE_SYSTEM_CONFIGURATION",
    scope: "ORGANIZATION",
    configurationType: "service_call_priority",
    supportsOrdering: true,
    supportsDeactivation: true,
    protectedValues: ["LOW", "NORMAL", "HIGH", "URGENT"],
  },
  {
    key: "machine_statuses",
    label: "Machine Statuses",
    description: "Operational machine status values.",
    permission: "MANAGE_SYSTEM_CONFIGURATION",
    scope: "ORGANIZATION",
    configurationType: "machine_status",
    supportsOrdering: true,
    supportsDeactivation: true,
    protectedValues: ["ONLINE", "DOWN"],
  },
  {
    key: "symptom_categories",
    label: "Symptom Categories",
    description: "Symptom categories for diagnostics and service notes.",
    permission: "MANAGE_SYSTEM_CONFIGURATION",
    scope: "ORGANIZATION",
    configurationType: "symptom_category",
    supportsOrdering: true,
    supportsDeactivation: true,
  },
  {
    key: "regions",
    label: "Regions & Territories",
    description: "Operating regions used for access scoping.",
    permission: "MANAGE_SYSTEM_CONFIGURATION",
    scope: "ORGANIZATION",
    configurationType: "region",
    supportsOrdering: true,
    supportsDeactivation: true,
  },
  {
    key: "deletion_reasons",
    label: "Deletion Reasons",
    description: "Configurable reasons for soft-deleting operational records.",
    permission: "MANAGE_SYSTEM_CONFIGURATION",
    scope: "ORGANIZATION",
    configurationType: "deletion_reason",
    supportsOrdering: true,
    supportsDeactivation: true,
    protectedValues: [
      "DUPLICATE_RECORD",
      "CREATED_IN_ERROR",
      "TEST_RECORD",
      "OTHER",
    ],
  },
];
