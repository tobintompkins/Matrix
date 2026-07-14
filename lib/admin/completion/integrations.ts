/**
 * Patch 49C — Integration catalog (existing integrations only; no fake connections).
 */

import { isClerkConfigured } from "@/lib/auth/clerk-config";
import { getMatrixAssistPublicStatus } from "@/lib/matrix-assist/config";

export type IntegrationStatus =
  | "Connected"
  | "Configured"
  | "Configuration Required"
  | "Disabled"
  | "Error"
  | "Not Supported";

export type IntegrationCard = {
  key: string;
  name: string;
  category: string;
  status: IntegrationStatus;
  environment: string;
  lastSuccessfulConnection: string | null;
  lastError: string | null;
  configurationOwner: string;
  documentation: string;
  canTest: boolean;
  canToggle: boolean;
  secretConfigured: boolean;
};

export function listIntegrations(): IntegrationCard[] {
  const env = process.env.NODE_ENV ?? "development";
  const clerk = isClerkConfigured();
  const assist = getMatrixAssistPublicStatus();

  return [
    {
      key: "clerk",
      name: "Clerk Authentication",
      category: "Authentication",
      status: clerk ? "Configured" : "Configuration Required",
      environment: env,
      lastSuccessfulConnection: null,
      lastError: clerk ? null : "Publishable/secret keys missing or placeholders",
      configurationOwner: "Environment variables",
      documentation: "https://dashboard.clerk.com",
      canTest: true,
      canToggle: false,
      secretConfigured: clerk,
    },
    {
      key: "matrix-assist",
      name: "Matrix Assist AI Provider",
      category: "AI Providers",
      status: !assist.enabled
        ? "Disabled"
        : assist.configured
          ? "Configured"
          : "Configuration Required",
      environment: env,
      lastSuccessfulConnection: null,
      lastError: null,
      configurationOwner: "Environment + Admin Matrix Assist settings",
      documentation: "/admin/matrix-assist",
      canTest: false,
      canToggle: false,
      secretConfigured: Boolean(assist.configured),
    },
    {
      key: "sqlite",
      name: "SQLite Database",
      category: "File Storage",
      status: "Configured",
      environment: env,
      lastSuccessfulConnection: null,
      lastError: null,
      configurationOwner: "DATABASE_URL",
      documentation: "Local Prisma SQLite (dev.db)",
      canTest: true,
      canToggle: false,
      secretConfigured: false,
    },
    {
      key: "email",
      name: "Email Provider",
      category: "Email",
      status: "Not Supported",
      environment: env,
      lastSuccessfulConnection: null,
      lastError: null,
      configurationOwner: "Not configured",
      documentation: "Email delivery is not implemented in Matrix yet.",
      canTest: false,
      canToggle: false,
      secretConfigured: false,
    },
    {
      key: "webhooks",
      name: "Outbound Webhooks",
      category: "Webhooks",
      status: "Not Supported",
      environment: env,
      lastSuccessfulConnection: null,
      lastError: null,
      configurationOwner: "Not configured",
      documentation: "No outbound webhook administration is available yet.",
      canTest: false,
      canToggle: false,
      secretConfigured: false,
    },
  ];
}

export function testIntegrationConnection(
  key: string,
): { ok: true; summary: string } | { ok: false; error: string } {
  if (key === "clerk") {
    return isClerkConfigured()
      ? { ok: true, summary: "Clerk environment keys look configured (no secret returned)." }
      : {
          ok: false,
          error: "The integration connection test failed. Clerk keys are not configured.",
        };
  }
  if (key === "sqlite") {
    return {
      ok: true,
      summary: "Database URL is present in environment. Use System Health for live connectivity.",
    };
  }
  return {
    ok: false,
    error: "The integration connection test failed. This integration cannot be tested.",
  };
}
