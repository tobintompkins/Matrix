/**
 * Patch 49C — Version & deployment metadata from real package/runtime values.
 */

export type VersionInformation = {
  version: string;
  buildIdentifier: string;
  environment: string;
  nodeVersion: string;
  nextRuntime: string;
  generatedAt: string;
  releaseHistory: Array<{
    version: string;
    patchName: string;
    summary: string;
    migrationRequired: boolean;
    status: string;
  }>;
};

/** Prefer env; fall back to package.json version known for this release line. */
const PACKAGE_VERSION =
  process.env.npm_package_version?.trim() ||
  process.env.NEXT_PUBLIC_APP_VERSION?.trim() ||
  "0.1.0";

export function getVersionInformation(): VersionInformation {
  const version = PACKAGE_VERSION;
  const env = process.env.NODE_ENV ?? "development";
  const buildIdentifier =
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ||
    process.env.GIT_COMMIT?.slice(0, 12) ||
    `local-${version}`;

  return {
    version,
    buildIdentifier,
    environment: env,
    nodeVersion:
      typeof process !== "undefined" && process.version
        ? process.version
        : "unknown",
    nextRuntime: "Next.js App Router",
    generatedAt: new Date().toISOString(),
    releaseHistory: [
      {
        version,
        patchName: "49C — Enterprise Administration Completion",
        summary:
          "Executive dashboard, reports, system health, import/export, integrations, notifications, admin tools.",
        migrationRequired: false,
        status: "Current",
      },
      {
        version,
        patchName: "49B — Data Administration",
        summary:
          "Operational archive, soft delete, restore, Deleted Records, relationship impact.",
        migrationRequired: false,
        status: "Included",
      },
      {
        version,
        patchName: "49A — Administration Foundation",
        summary:
          "Users, roles, configuration, organization, features, audit, security.",
        migrationRequired: true,
        status: "Included",
      },
    ],
  };
}
