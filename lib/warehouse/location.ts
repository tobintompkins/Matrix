/** Bin location code helpers (Patch 43). */

export function formatBinCode(
  warehouseCode: string,
  zone: string,
  aisle: string,
  rack: string,
  shelf: string,
  bin: string,
  drawer = "",
): string {
  const parts = [warehouseCode, zone, aisle, rack, shelf, bin];
  if (drawer) parts.push(drawer);
  return parts.filter(Boolean).join("-");
}

export function parseBinCode(code: string): {
  warehouseCode: string;
  zone: string;
  aisle: string;
  rack: string;
  shelf: string;
  bin: string;
  drawer: string;
} | null {
  const parts = code.trim().toUpperCase().split("-").filter(Boolean);
  if (parts.length < 6) return null;
  return {
    warehouseCode: parts[0],
    zone: parts[1],
    aisle: parts[2],
    rack: parts[3],
    shelf: parts[4],
    bin: parts[5],
    drawer: parts[6] ?? "",
  };
}

export function matchesBinSegment(
  code: string,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const normalized = code.toLowerCase();
  if (normalized.includes(q)) return true;
  const segments = normalized.split("-");
  return segments.some((s) => s === q || s.includes(q));
}
