import { hasMatrixPermission } from "../auth/permissions";
import type { MatrixRole } from "../auth/types";

// Exhaustive against MatrixRole; do not accept inherited object property names.
const configuredRoles: Record<MatrixRole, true> = {
  SUPER_ADMIN: true, ADMIN: true, SERVICE_MANAGER: true,
  REGIONAL_MANAGER: true, OPERATIONS_MANAGER: true, DIRECTOR: true,
  FIELD_TECHNICIAN: true, WAREHOUSE_MANAGER: true, TRAINER: true,
  READ_ONLY_AUDITOR: true, CUSTOMER_ADMIN: true, CUSTOMER_MANAGER: true,
  CUSTOMER_USER: true, CUSTOMER_VIEWER: true,
};
export type FieldAccessDecision =
  | { allowed: true; role: MatrixRole }
  | { allowed: false; reason: "SIGNED_OUT" | "ROLE_NOT_CONFIGURED" | "FORBIDDEN" };

export function isFieldPage(pathname: string): boolean {
  return pathname === "/field" || pathname.startsWith("/field/");
}

/** Field entry requires trusted Clerk publicMetadata, never a development fallback. */
export function evaluateFieldAccess(
  userId: string | null | undefined,
  publicMetadata: Record<string, unknown> | null | undefined,
): FieldAccessDecision {
  if (!userId?.trim()) return { allowed: false, reason: "SIGNED_OUT" };
  const rawRole = publicMetadata?.matrixRole;
  if (typeof rawRole !== "string" ||
      !Object.prototype.hasOwnProperty.call(configuredRoles, rawRole)) {
    return { allowed: false, reason: "ROLE_NOT_CONFIGURED" };
  }
  const role = rawRole as MatrixRole;
  return hasMatrixPermission(role, "VIEW_FIELD")
    ? { allowed: true, role }
    : { allowed: false, reason: "FORBIDDEN" };
}
