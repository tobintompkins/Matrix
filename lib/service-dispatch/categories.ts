import type { ProblemCategory } from "./types";

export const DEFAULT_PROBLEM_CATEGORIES: ProblemCategory[] = [
  { id: "cat-paper-jam", code: "PAPER_JAM", label: "Paper Jam", description: "Paper path jams", enabled: true, sortOrder: 10 },
  { id: "cat-print-quality", code: "PRINT_QUALITY", label: "Print Quality", description: "Image quality defects", enabled: true, sortOrder: 20 },
  { id: "cat-ink", code: "INK_ISSUE", label: "Ink Issue", description: "Ink supply / density", enabled: true, sortOrder: 30 },
  { id: "cat-feed", code: "PAPER_FEED", label: "Paper Feed", description: "Feed / pickup issues", enabled: true, sortOrder: 40 },
  { id: "cat-scanner", code: "SCANNER_ISSUE", label: "Scanner Issue", description: "Scanner / ADF", enabled: true, sortOrder: 50 },
  { id: "cat-network", code: "NETWORK_ISSUE", label: "Network Issue", description: "Connectivity", enabled: true, sortOrder: 60 },
  { id: "cat-software", code: "SOFTWARE_ISSUE", label: "Software Issue", description: "Controller / driver", enabled: true, sortOrder: 70 },
  { id: "cat-finisher", code: "FINISHER_ISSUE", label: "Finisher Issue", description: "Finisher / stapler", enabled: true, sortOrder: 80 },
  { id: "cat-hcf", code: "HIGH_CAPACITY_FEEDER", label: "High-Capacity Feeder", description: "HCF issues", enabled: true, sortOrder: 90 },
  { id: "cat-error", code: "ERROR_CODE", label: "Error Code", description: "Displayed error code", enabled: true, sortOrder: 100 },
  { id: "cat-power", code: "POWER_ISSUE", label: "Power Issue", description: "Power / boot", enabled: true, sortOrder: 110 },
  { id: "cat-pm", code: "PREVENTIVE_MAINTENANCE", label: "Preventive Maintenance", description: "Scheduled PM", enabled: true, sortOrder: 120 },
  { id: "cat-install", code: "INSTALLATION", label: "Installation", description: "New install", enabled: true, sortOrder: 130 },
  { id: "cat-training", code: "TRAINING_REQUEST", label: "Training Request", description: "Operator training", enabled: true, sortOrder: 140 },
  { id: "cat-parts", code: "PARTS_REQUEST", label: "Parts Request", description: "Parts only", enabled: true, sortOrder: 150 },
  { id: "cat-reloc", code: "RELOCATION", label: "Relocation", description: "Move machine", enabled: true, sortOrder: 160 },
  { id: "cat-inspect", code: "INSPECTION", label: "Inspection", description: "Site inspection", enabled: true, sortOrder: 170 },
  { id: "cat-other", code: "OTHER", label: "Other", description: "Uncategorized", enabled: true, sortOrder: 999 },
];

export function listEnabledCategories(categories: ProblemCategory[]): ProblemCategory[] {
  return categories
    .filter((c) => c.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function upsertCategory(
  categories: ProblemCategory[],
  patch: Partial<ProblemCategory> & { id: string },
): ProblemCategory[] {
  const idx = categories.findIndex((c) => c.id === patch.id);
  if (idx < 0) {
    const created: ProblemCategory = {
      id: patch.id,
      code: patch.code ?? "OTHER",
      label: patch.label ?? "New Category",
      description: patch.description ?? "",
      enabled: patch.enabled ?? true,
      sortOrder: patch.sortOrder ?? 500,
    };
    return [...categories, created];
  }
  const next = [...categories];
  next[idx] = { ...next[idx], ...patch };
  return next;
}

export function reorderCategories(
  categories: ProblemCategory[],
  orderedIds: string[],
): ProblemCategory[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const reordered: ProblemCategory[] = [];
  orderedIds.forEach((id, i) => {
    const row = byId.get(id);
    if (row) {
      reordered.push({ ...row, sortOrder: (i + 1) * 10 });
      byId.delete(id);
    }
  });
  for (const leftover of byId.values()) reordered.push(leftover);
  return reordered;
}
