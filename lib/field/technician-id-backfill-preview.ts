import type { TechnicianIdCoverage } from "./technician-id-coverage";

export type TechnicianIdBackfillPreview = {
  ready: Array<{ workOrderId: string; workOrderNumber: string; technicianName: string; technicianId: string }>;
  unresolved: Array<{ workOrderId: string; workOrderNumber: string; technicianName: string }>;
};

export function parseTechnicianIdMapping(raw: string): Record<string, string> {
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error("Mapping must be a JSON object of technician name to durable user ID.");
  }
  const mapping: Record<string, string> = {};
  for (const [name, userId] of Object.entries(parsed)) {
    const normalizedName = name.trim().toLocaleLowerCase();
    if (!normalizedName || typeof userId !== "string" || !userId.trim()) {
      throw new Error("Each mapping needs a technician name and a durable user ID.");
    }
    mapping[normalizedName] = userId.trim();
  }
  return mapping;
}

/** Preview only. No work-order data is written by this function. */
export function previewTechnicianIdBackfill(
  coverage: TechnicianIdCoverage,
  mapping: Record<string, string>,
): TechnicianIdBackfillPreview {
  const ready: TechnicianIdBackfillPreview["ready"] = [];
  const unresolved: TechnicianIdBackfillPreview["unresolved"] = [];
  for (const item of coverage.nameFallbackWorkOrders) {
    const technicianId = mapping[item.technicianName.trim().toLocaleLowerCase()];
    if (technicianId) {
      ready.push({ workOrderId: item.id, workOrderNumber: item.workOrderNumber, technicianName: item.technicianName, technicianId });
    } else {
      unresolved.push({ workOrderId: item.id, workOrderNumber: item.workOrderNumber, technicianName: item.technicianName });
    }
  }
  return { ready, unresolved };
}
