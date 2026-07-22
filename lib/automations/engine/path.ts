/**
 * Patch 51A.2 — Safe path resolver (no eval).
 */

export function resolvePath(
  root: unknown,
  path: string,
): unknown {
  if (!path || path === ".") return root;
  const parts = path.split(".").filter(Boolean);
  let cur: unknown = root;
  for (const part of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}
