"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export type ColumnVisibilityOption = {
  key: string;
  label: string;
  locked?: boolean;
  defaultVisible?: boolean;
};

const STORAGE_PREFIX = "matrix.table.columns.";

function readStored(storageKey: string): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${storageKey}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return null;
  }
}

function writeStored(storageKey: string, keys: string[]) {
  try {
    localStorage.setItem(
      `${STORAGE_PREFIX}${storageKey}`,
      JSON.stringify(keys),
    );
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * Local-only column visibility preferences (no sensitive data).
 */
export function useColumnVisibility(
  storageKey: string,
  options: ColumnVisibilityOption[],
) {
  const lockedKeys = useMemo(
    () => options.filter((o) => o.locked).map((o) => o.key),
    [options],
  );

  const defaultVisible = useMemo(
    () =>
      options
        .filter((o) => o.locked || o.defaultVisible !== false)
        .map((o) => o.key),
    [options],
  );

  const [visibleKeys, setVisibleKeys] = useState<string[]>(defaultVisible);

  useEffect(() => {
    const stored = readStored(storageKey);
    if (!stored) return;
    const allowed = new Set(options.map((o) => o.key));
    const next = Array.from(
      new Set([
        ...lockedKeys,
        ...stored.filter((key) => allowed.has(key)),
      ]),
    );
    setVisibleKeys(next.length > 0 ? next : defaultVisible);
  }, [storageKey, options, lockedKeys, defaultVisible]);

  const setVisible = useCallback(
    (keys: string[]) => {
      const next = Array.from(new Set([...lockedKeys, ...keys]));
      setVisibleKeys(next);
      writeStored(storageKey, next);
    },
    [lockedKeys, storageKey],
  );

  const toggle = useCallback(
    (key: string) => {
      if (lockedKeys.includes(key)) return;
      setVisibleKeys((current) => {
        const next = current.includes(key)
          ? current.filter((item) => item !== key)
          : [...current, key];
        const withLocked = Array.from(new Set([...lockedKeys, ...next]));
        writeStored(storageKey, withLocked);
        return withLocked;
      });
    },
    [lockedKeys, storageKey],
  );

  const isVisible = useCallback(
    (key: string) => visibleKeys.includes(key),
    [visibleKeys],
  );

  return {
    visibleKeys,
    isVisible,
    toggle,
    setVisible,
    options,
  };
}
