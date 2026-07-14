/**
 * Patch 49C — Controlled custom-field foundation (metadata only, non-executable).
 */

export type CustomFieldType =
  | "SHORT_TEXT"
  | "LONG_TEXT"
  | "NUMBER"
  | "DATE"
  | "CHECKBOX"
  | "SINGLE_SELECT";

export type CustomFieldRecordType = "CUSTOMER" | "MACHINE" | "SERVICE_CALL";

export type AdminCustomField = {
  id: string;
  organizationId: string;
  recordType: CustomFieldRecordType;
  fieldKey: string;
  label: string;
  description: string;
  fieldType: CustomFieldType;
  required: boolean;
  active: boolean;
  displayOrder: number;
  options: string[];
  createdAt: string;
  updatedAt: string;
};

const STORAGE_KEY = "matrix.admin.custom-fields.v1";
const MAX_FIELDS = 25;
let memory: AdminCustomField[] | null = null;

function read(): AdminCustomField[] {
  if (memory) return memory;
  if (typeof window !== "undefined") {
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        memory = JSON.parse(raw) as AdminCustomField[];
        return memory;
      }
    } catch {
      /* ignore */
    }
  }
  memory = [];
  return memory;
}

function write(next: AdminCustomField[]) {
  memory = next;
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

function toKey(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
}

export function listCustomFields(
  recordType?: CustomFieldRecordType,
): AdminCustomField[] {
  let rows = read();
  if (recordType) rows = rows.filter((f) => f.recordType === recordType);
  return rows.sort((a, b) => a.displayOrder - b.displayOrder);
}

export function createCustomField(input: {
  organizationId: string;
  recordType: CustomFieldRecordType;
  label: string;
  description?: string;
  fieldType: CustomFieldType;
  required?: boolean;
  options?: string[];
}): { ok: true; field: AdminCustomField } | { ok: false; error: string } {
  const label = input.label.trim();
  if (label.length < 2) return { ok: false, error: "Label is required." };
  if (read().filter((f) => f.active).length >= MAX_FIELDS) {
    return { ok: false, error: `Maximum of ${MAX_FIELDS} active custom fields.` };
  }
  const fieldKey = toKey(label);
  if (!fieldKey) return { ok: false, error: "Unable to derive a stable field key." };
  if (read().some((f) => f.fieldKey === fieldKey && f.recordType === input.recordType)) {
    return { ok: false, error: "A field with this key already exists for the record type." };
  }
  if (input.fieldType === "SINGLE_SELECT" && !(input.options?.length)) {
    return { ok: false, error: "Single select fields require options." };
  }
  const now = new Date().toISOString();
  const field: AdminCustomField = {
    id: `cf-${Date.now()}`,
    organizationId: input.organizationId,
    recordType: input.recordType,
    fieldKey,
    label,
    description: (input.description ?? "").trim().slice(0, 500),
    fieldType: input.fieldType,
    required: Boolean(input.required),
    active: true,
    displayOrder: read().length + 1,
    options: (input.options ?? []).map((o) => o.trim()).filter(Boolean).slice(0, 50),
    createdAt: now,
    updatedAt: now,
  };
  write([...read(), field]);
  return { ok: true, field };
}

export function deactivateCustomField(
  id: string,
): { ok: true } | { ok: false; error: string } {
  const rows = read();
  const idx = rows.findIndex((f) => f.id === id);
  if (idx < 0) return { ok: false, error: "Custom field not found." };
  const next = [...rows];
  next[idx] = { ...next[idx], active: false, updatedAt: new Date().toISOString() };
  write(next);
  return { ok: true };
}
