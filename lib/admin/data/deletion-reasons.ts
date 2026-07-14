/**
 * Patch 49B — configurable deletion reasons (System Configuration foundation).
 * Defaults live here; org overrides can be stored as configurationType `deletion_reason`.
 */

import type { DeletionReasonKey } from "./types";

export type DeletionReasonDefinition = {
  key: DeletionReasonKey;
  label: string;
  requiresNotes: boolean;
};

export const DEFAULT_DELETION_REASONS: DeletionReasonDefinition[] = [
  { key: "DUPLICATE_RECORD", label: "Duplicate Record", requiresNotes: false },
  { key: "CREATED_IN_ERROR", label: "Created in Error", requiresNotes: false },
  { key: "TEST_RECORD", label: "Test Record", requiresNotes: false },
  {
    key: "INCORRECT_CUSTOMER",
    label: "Incorrect Customer",
    requiresNotes: false,
  },
  {
    key: "INCORRECT_MACHINE",
    label: "Incorrect Machine",
    requiresNotes: false,
  },
  {
    key: "INCORRECT_ASSOCIATION",
    label: "Incorrect Association",
    requiresNotes: false,
  },
  { key: "DATA_CLEANUP", label: "Data Cleanup", requiresNotes: false },
  {
    key: "IMPORTED_IN_ERROR",
    label: "Imported in Error",
    requiresNotes: false,
  },
  { key: "CUSTOMER_REQUEST", label: "Customer Request", requiresNotes: false },
  { key: "OTHER", label: "Other", requiresNotes: true },
];

export function getDeletionReasonLabel(key: string): string {
  return (
    DEFAULT_DELETION_REASONS.find((r) => r.key === key)?.label ?? key
  );
}

export function deletionReasonRequiresNotes(key: string): boolean {
  return (
    DEFAULT_DELETION_REASONS.find((r) => r.key === key)?.requiresNotes ??
    false
  );
}

export function validateDeletionReason(
  reason: string,
  notes?: string | null,
): { ok: true } | { ok: false; error: string } {
  const trimmed = reason.trim();
  if (!trimmed) {
    return { ok: false, error: "A deletion reason is required." };
  }
  if (deletionReasonRequiresNotes(trimmed) && !notes?.trim()) {
    return {
      ok: false,
      error: "Notes are required when the deletion reason is Other.",
    };
  }
  return { ok: true };
}
