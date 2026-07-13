"use client";

import type { ReactNode } from "react";
import {
  canAccessRoute,
  hasMatrixPermission,
} from "@/lib/auth/permissions";
import {
  DEV_FALLBACK_ROLE,
  type MatrixPermission,
  type MatrixRole,
} from "@/lib/auth/types";
import { MatrixButton, MatrixCard } from "@/app/components/ui";

const VALID_ROLES: MatrixRole[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "SERVICE_MANAGER",
  "FIELD_TECHNICIAN",
  "WAREHOUSE_MANAGER",
  "TRAINER",
  "CUSTOMER_VIEWER",
];

type MatrixAuthGuardProps = {
  children: ReactNode;
  requiredPermissions?: MatrixPermission[];
  /** Optional pathname for route-based checks */
  pathname?: string;
  /**
   * Role override. Until Clerk publicMetadata.matrixRole is connected,
   * defaults to SUPER_ADMIN so development is not blocked.
   */
  role?: MatrixRole;
};

export default function MatrixAuthGuard({
  children,
  requiredPermissions = [],
  pathname,
  role = DEV_FALLBACK_ROLE,
}: MatrixAuthGuardProps) {
  const matrixRole: MatrixRole = VALID_ROLES.includes(role)
    ? role
    : DEV_FALLBACK_ROLE;

  const missing = requiredPermissions.filter(
    (permission) => !hasMatrixPermission(matrixRole, permission),
  );

  const routeBlocked =
    pathname != null && !canAccessRoute(matrixRole, pathname);

  if (missing.length > 0 || routeBlocked) {
    return (
      <MatrixCard
        title="Access Restricted"
        subtitle="You do not have permission to view this area of Matrix."
      >
        <p className="text-sm text-slate-400">
          Required permission
          {missing.length !== 1 ? "s" : ""}:{" "}
          <span className="font-mono text-amber-300">
            {missing.length > 0 ? missing.join(", ") : "route access"}
          </span>
        </p>
        <p className="mt-3 text-sm text-slate-500">
          Current role (fallback until Clerk metadata is connected):{" "}
          <span className="font-semibold text-cyan-300">{matrixRole}</span>
        </p>
        <div className="mt-6">
          <MatrixButton href="/dashboard" variant="primary" size="md">
            Back to Dashboard
          </MatrixButton>
        </div>
      </MatrixCard>
    );
  }

  return <>{children}</>;
}
