import { canViewOtherTechniciansField } from "@/lib/auth/field-permissions";
import type { MatrixUserProfile } from "@/lib/auth/types";
import type { WorkOrder } from "@/lib/work-orders/types";

/** APIs require a configured Clerk role; the local fallback is UI-only. */
export function hasConfiguredFieldApiIdentity(profile: MatrixUserProfile): boolean {
  return !profile.usingDevFallbackRole;
}

/** Dispatcher assignments are names until the server repository uses technician IDs. */
export function canAccessFieldWorkOrder(
  profile: MatrixUserProfile,
  workOrder: Pick<WorkOrder, "assignedTechnician" | "secondaryTechnician">,
): boolean {
  if (canViewOtherTechniciansField(profile.role)) return true;
  const technicianName = (profile.technicianName ?? profile.displayName ?? "")
    .trim().toLocaleLowerCase();
  if (!technicianName) return false;
  return [workOrder.assignedTechnician, workOrder.secondaryTechnician].some(
    (assigned) => assigned.trim().toLocaleLowerCase() === technicianName,
  );
}

/** Never take the actor label from the browser payload. */
export function fieldApiActor(profile: MatrixUserProfile): string {
  return (profile.technicianName ?? profile.displayName ?? "Matrix User").trim();
}
