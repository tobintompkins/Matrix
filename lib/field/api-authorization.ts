import { canViewOtherTechniciansField } from "@/lib/auth/field-permissions";
import type { MatrixUserProfile } from "@/lib/auth/types";
import {
  isTechnicianAssignedToWorkOrder,
  type FieldWorkOrderAssignment,
} from "@/lib/work-orders/field-technician-assignment";

/** APIs require a configured Clerk role; the local fallback is UI-only. */
export function hasConfiguredFieldApiIdentity(profile: MatrixUserProfile): boolean {
  return !profile.usingDevFallbackRole;
}

/** Technicians may access primary/secondary assignments via Clerk id or legacy name. */
export function canAccessFieldWorkOrder(
  profile: MatrixUserProfile,
  workOrder: FieldWorkOrderAssignment,
): boolean {
  if (canViewOtherTechniciansField(profile.role)) return true;
  return isTechnicianAssignedToWorkOrder(
    {
      userId: profile.userId,
      technicianId: profile.technicianId,
      technicianName: profile.technicianName,
      displayName: profile.displayName,
    },
    workOrder,
  );
}

/** Never take the actor label from the browser payload. */
export function fieldApiActor(profile: MatrixUserProfile): string {
  return (profile.technicianName ?? profile.displayName ?? "Matrix User").trim();
}
