/**
 * Field work-order assignment checks (51B.2 technician ID migration).
 * Prefer durable Clerk user IDs when present; fall back to legacy name fields.
 */
export type FieldWorkOrderAssignment = {
  assignedTechnician: string;
  secondaryTechnician: string;
  assignedTechnicianId?: string | null;
  secondaryTechnicianId?: string | null;
};

export type FieldTechnicianIdentity = {
  userId: string;
  technicianId?: string;
  technicianName?: string;
  displayName?: string;
};

export function durableTechnicianIdentityKeys(profile: FieldTechnicianIdentity): string[] {
  const keys = new Set<string>();
  const userId = profile.userId?.trim();
  const technicianId = profile.technicianId?.trim();
  if (userId) keys.add(userId);
  if (technicianId) keys.add(technicianId);
  return [...keys];
}

function normalizeTechnicianName(value: string | null | undefined): string {
  return (value ?? "").trim().toLocaleLowerCase();
}

function assignmentNameMatches(
  profile: FieldTechnicianIdentity,
  workOrder: FieldWorkOrderAssignment,
): boolean {
  const technicianName = normalizeTechnicianName(
    profile.technicianName ?? profile.displayName ?? "",
  );
  if (!technicianName) return false;
  return [workOrder.assignedTechnician, workOrder.secondaryTechnician].some(
    (assigned) => normalizeTechnicianName(assigned) === technicianName,
  );
}

function assignmentIdMatches(
  profile: FieldTechnicianIdentity,
  workOrder: FieldWorkOrderAssignment,
): boolean {
  const keys = durableTechnicianIdentityKeys(profile);
  if (keys.length === 0) return false;
  const primaryId = workOrder.assignedTechnicianId?.trim();
  const secondaryId = workOrder.secondaryTechnicianId?.trim();
  if (!primaryId && !secondaryId) return false;
  return keys.some((key) => key === primaryId || key === secondaryId);
}

/** True when the signed-in technician is primary or secondary on the work order. */
export function isTechnicianAssignedToWorkOrder(
  profile: FieldTechnicianIdentity,
  workOrder: FieldWorkOrderAssignment,
): boolean {
  if (assignmentIdMatches(profile, workOrder)) return true;
  return assignmentNameMatches(profile, workOrder);
}

export function parseOptionalTechnicianId(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
