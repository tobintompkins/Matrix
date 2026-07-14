"use client";

import type { ReactNode } from "react";
import { useUser } from "@clerk/nextjs";
import {
  canAccessRoute,
  hasMatrixPermission,
  resolveMatrixRole,
} from "@/lib/auth/permissions";
import {
  DEV_FALLBACK_ROLE,
  type MatrixPermission,
  type MatrixRole,
} from "@/lib/auth/types";
import { MatrixButton, MatrixCard } from "@/app/components/ui";

type MatrixAuthGuardProps = {
  children: ReactNode;
  requiredPermissions?: MatrixPermission[];
  pathname?: string;
  /** Optional override; defaults to Clerk publicMetadata.matrixRole */
  role?: MatrixRole;
  accessDeniedMessage?: string;
};

export default function MatrixAuthGuard({
  children,
  requiredPermissions = [],
  pathname,
  role,
  accessDeniedMessage,
}: MatrixAuthGuardProps) {
  const { user, isLoaded } = useUser();
  const resolved = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );
  const matrixRole: MatrixRole = role ?? resolved.role ?? DEV_FALLBACK_ROLE;

  if (!isLoaded) {
    return (
      <p className="text-sm text-slate-400" aria-live="polite">
        Checking access…
      </p>
    );
  }

  const missing = requiredPermissions.filter(
    (permission) => !hasMatrixPermission(matrixRole, permission),
  );

  const routeBlocked =
    pathname != null && !canAccessRoute(matrixRole, pathname);

  if (missing.length > 0 || routeBlocked) {
    return (
      <MatrixCard
        title="Access Restricted"
        subtitle={
          accessDeniedMessage ??
          "You do not have permission to access the Administration Center."
        }
      >
        <p className="mt-3 text-sm text-slate-500">
          Signed-in role:{" "}
          <span className="font-semibold text-cyan-300">{matrixRole}</span>
          {resolved.usingDevFallbackRole ? " (development fallback)" : ""}
        </p>
        <div className="mt-6">
          <MatrixButton href="/dashboard" variant="primary" size="md">
            Back to Service Hub
          </MatrixButton>
        </div>
      </MatrixCard>
    );
  }

  return <>{children}</>;
}
