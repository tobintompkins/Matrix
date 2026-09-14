import { evaluateFieldAccess } from "./access";
import type { MatrixRole } from "../auth/types";
export type FieldIdentity = { userId: string; technicianName: string; role: MatrixRole };
export function resolveFieldIdentity(user: {
  id: string; fullName?: string | null;
  publicMetadata?: Record<string, unknown> | null;
} | null | undefined): FieldIdentity | null {
  if (!user) return null;
  const access = evaluateFieldAccess(user.id, user.publicMetadata);
  if (!access.allowed) return null;
  const configuredName = user.publicMetadata?.technicianName;
  const technicianName = typeof configuredName === "string" && configuredName.trim()
    ? configuredName.trim() : user.fullName?.trim();
  if (!technicianName) return null;
  return { userId: user.id, technicianName, role: access.role };
}
