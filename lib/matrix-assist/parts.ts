import { findPartByNumber, listBalances, listLocations } from "@/lib/inventory";
import type { PartSuggestion } from "./types";
import { matchTemplates } from "./templates";

/**
 * Suggest related parts from templates + catalog.
 * Never mutates inventory.
 */
export function suggestPartsForSymptom(input: {
  symptomCategory?: string | null;
  printerModel?: string | null;
  errorCode?: string | null;
  canViewInventory: boolean;
}): PartSuggestion[] {
  const templates = matchTemplates({
    symptomCategory: input.symptomCategory,
    printerModel: input.printerModel,
    errorCode: input.errorCode,
  });
  const suggestions: PartSuggestion[] = [];
  const seen = new Set<string>();
  const locations = listLocations();

  for (const t of templates) {
    for (const part of t.relatedParts) {
      const key = part.partNumber.toUpperCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const catalog = findPartByNumber(part.partNumber);
      let available: number | null = null;
      let reserved: number | null = null;
      let warehouse: string | null = null;
      let stockHidden = false;

      if (!input.canViewInventory) {
        stockHidden = true;
      } else if (catalog) {
        const balances = listBalances().filter((b) => b.partId === catalog.id);
        available = balances.reduce((sum, b) => sum + (b.quantityOnHand ?? 0), 0);
        reserved = balances.reduce(
          (sum, b) => sum + (b.quantityReserved ?? 0),
          0,
        );
        const loc = locations.find((l) => l.id === balances[0]?.locationId);
        warehouse = loc?.name ?? balances[0]?.locationId ?? null;
      }

      suggestions.push({
        partNumber: part.partNumber,
        description: catalog?.description ?? part.description,
        compatibleModel: input.printerModel ?? undefined,
        assembly: t.assembly,
        available: stockHidden ? null : available,
        reserved: stockHidden ? null : reserved,
        warehouse: stockHidden ? null : warehouse,
        stockHidden,
      });
    }
  }

  return suggestions.slice(0, 8);
}
