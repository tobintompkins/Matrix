/**
 * Patch 51C.1 — Bridge Organization Health into Enterprise Intelligence (ECC).
 * Reads existing org-health engines; does not re-score.
 */

import type { AdminActor } from "@/lib/admin/auth";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import {
  getOrganizationHealthSettings,
} from "@/lib/organization-health/settings";
import { collectCategoryInputs } from "@/lib/organization-health/metrics";
import {
  computeOverallHealthScore,
  type HealthCategoryKey,
} from "@/lib/organization-health/score";
import {
  listOrganizationHealthAlerts,
  serializeAlert,
} from "@/lib/organization-health/alerts";

const CATEGORY_LABELS: Record<string, string> = {
  fleet: "Fleet",
  service: "Service",
  pm: "PM",
  inventory: "Inventory",
  technician: "Technician",
  customer: "Customer",
  financial: "Financial",
  security: "Security",
};

export type OrgHealthBridgePanel = {
  enabled: boolean;
  overallScore: number | null;
  classification: string;
  availableCategories: number;
  categories: Array<{
    key: HealthCategoryKey | string;
    label: string;
    score: number | null;
    status: string;
  }>;
  kpis: Array<{ key: string; label: string; value: string }>;
  href: string;
  message?: string;
};

export type OrgHealthBridgeAlert = {
  id: string;
  title: string;
  severity: string;
  status: string;
  href: string;
};

function systemActor(organizationId: string): AdminActor {
  return {
    role: "SUPER_ADMIN",
    displayName: "Enterprise Intelligence",
    userId: "system:enterprise-intelligence",
    organizationId,
    regionId: null,
    authenticated: true,
  };
}

export async function getOrgHealthBridge(
  organizationId = DEFAULT_ORG_ID,
): Promise<OrgHealthBridgePanel> {
  try {
    const actor = systemActor(organizationId);
    const settings = await getOrganizationHealthSettings(organizationId);
    if (!settings.enabled) {
      return {
        enabled: false,
        overallScore: null,
        classification: "unavailable",
        availableCategories: 0,
        categories: [],
        kpis: [],
        href: "/admin/organization-health",
        message: "Organization Health is disabled for this organization.",
      };
    }

    const collected = await collectCategoryInputs(actor, settings);
    const score = computeOverallHealthScore(collected.inputs, settings);

    return {
      enabled: true,
      overallScore: score.overallScore,
      classification: String(score.classification),
      availableCategories: score.categories.filter((c) => c.available).length,
      categories: score.categories.map((c) => ({
        key: c.key,
        label: CATEGORY_LABELS[c.key] ?? c.key,
        score: c.score,
        status: String(c.classification),
      })),
      kpis: [
        {
          key: "fleetAvailability",
          label: "Fleet availability",
          value:
            collected.kpis.fleetAvailability == null
              ? "—"
              : `${collected.kpis.fleetAvailability}%`,
        },
        {
          key: "criticalCalls",
          label: "Critical open calls",
          value: String(collected.kpis.criticalOpenCalls ?? 0),
        },
        {
          key: "pmCompliance",
          label: "PM compliance",
          value:
            collected.kpis.pmCompliance == null
              ? "—"
              : `${collected.kpis.pmCompliance}%`,
        },
      ],
      href: "/admin/organization-health",
    };
  } catch {
    return {
      enabled: false,
      overallScore: null,
      classification: "unavailable",
      availableCategories: 0,
      categories: [],
      kpis: [],
      href: "/admin/organization-health",
      message: "Organization Health could not be loaded.",
    };
  }
}

export async function listOrgHealthBridgeAlerts(
  organizationId = DEFAULT_ORG_ID,
): Promise<OrgHealthBridgeAlert[]> {
  try {
    const rows = await listOrganizationHealthAlerts(organizationId);
    return rows
      .filter((a) =>
        ["OPEN", "ACKNOWLEDGED", "ASSIGNED", "IN_PROGRESS"].includes(a.status),
      )
      .slice(0, 20)
      .map((a) => {
        const s = serializeAlert(a);
        return {
          id: s.id,
          title: s.title,
          severity: s.severity,
          status: s.status,
          href: "/admin/organization-health/alerts",
        };
      });
  } catch {
    return [];
  }
}
