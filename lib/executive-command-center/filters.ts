/**
 * Patch 51A.5 Part 3 Completion — shared filter parsing (client-safe).
 */

export type ExecutiveScopeFilters = {
  customer?: string;
  site?: string;
  technician?: string;
  model?: string;
  status?: string;
  organizationId?: string;
  start?: string;
  end?: string;
};

export function parseExecutiveFilters(
  params: URLSearchParams | Record<string, string | null | undefined>,
): ExecutiveScopeFilters {
  const get = (key: string) => {
    if (params instanceof URLSearchParams) {
      return params.get(key) || undefined;
    }
    const v = params[key];
    return v == null || v === "" ? undefined : String(v);
  };
  return {
    customer: get("customer"),
    site: get("site"),
    technician: get("technician"),
    model: get("model"),
    status: get("status"),
    organizationId: get("organizationId"),
    start: get("start"),
    end: get("end"),
  };
}

export function filtersToQuery(filters: ExecutiveScopeFilters): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v) p.set(k, v);
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function matchesText(
  haystack: string | null | undefined,
  needle: string | undefined,
): boolean {
  if (!needle) return true;
  if (!haystack) return false;
  return haystack.toLowerCase().includes(needle.toLowerCase());
}
