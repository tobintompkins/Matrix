export type TechnicianAssignmentCoverageRow = {
  id: string;
  workOrderNumber: string;
  assignedTechnician: string | null;
  assignedTechnicianId: string | null;
  secondaryTechnician: string | null;
  secondaryTechnicianId: string | null;
};

export type TechnicianIdCoverage = {
  totalWorkOrders: number;
  primaryIdAssigned: number;
  secondaryIdAssigned: number;
  nameFallbackWorkOrders: Array<{ id: string; workOrderNumber: string; technicianName: string }>;
  unassignedWorkOrders: Array<{ id: string; workOrderNumber: string }>;
};

/** Read-only coverage report before any production technician-ID backfill. */
export function buildTechnicianIdCoverage(rows: TechnicianAssignmentCoverageRow[]): TechnicianIdCoverage {
  const nameFallbackWorkOrders: TechnicianIdCoverage["nameFallbackWorkOrders"] = [];
  const unassignedWorkOrders: TechnicianIdCoverage["unassignedWorkOrders"] = [];
  let primaryIdAssigned = 0;
  let secondaryIdAssigned = 0;

  for (const row of rows) {
    const primaryName = row.assignedTechnician?.trim() ?? "";
    const primaryId = row.assignedTechnicianId?.trim() ?? "";
    const secondaryName = row.secondaryTechnician?.trim() ?? "";
    const secondaryId = row.secondaryTechnicianId?.trim() ?? "";

    if (primaryId) primaryIdAssigned += 1;
    if (secondaryId) secondaryIdAssigned += 1;
    if (primaryName && !primaryId) {
      nameFallbackWorkOrders.push({ id: row.id, workOrderNumber: row.workOrderNumber, technicianName: primaryName });
    }
    if (!primaryName && !primaryId && !secondaryName && !secondaryId) {
      unassignedWorkOrders.push({ id: row.id, workOrderNumber: row.workOrderNumber });
    }
  }

  return {
    totalWorkOrders: rows.length,
    primaryIdAssigned,
    secondaryIdAssigned,
    nameFallbackWorkOrders,
    unassignedWorkOrders,
  };
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

/** Portable review list for mapping legacy names to durable Clerk IDs. */
export function buildTechnicianIdBackfillReviewCsv(coverage: TechnicianIdCoverage): string {
  const rows = ["review_type,work_order_id,work_order_number,technician_name"];
  for (const item of coverage.nameFallbackWorkOrders) {
    rows.push(["NAME_FALLBACK", item.id, item.workOrderNumber, item.technicianName].map(csvCell).join(","));
  }
  for (const item of coverage.unassignedWorkOrders) {
    rows.push(["UNASSIGNED", item.id, item.workOrderNumber, ""].map(csvCell).join(","));
  }
  return `${rows.join("\r\n")}\r\n`;
}
