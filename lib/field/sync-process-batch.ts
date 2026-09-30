export const FIELD_SYNC_PROCESS_BATCH_LIMITS = [5, 10, 25, 50] as const;

export type FieldSyncProcessBatchLimit = (typeof FIELD_SYNC_PROCESS_BATCH_LIMITS)[number];

/** Restricts manager-triggered processing to a deliberately small, known batch. */
export function toFieldSyncProcessBatchLimit(value: unknown): FieldSyncProcessBatchLimit {
  const numberValue = typeof value === "number" ? value : Number(value);
  return FIELD_SYNC_PROCESS_BATCH_LIMITS.includes(numberValue as FieldSyncProcessBatchLimit)
    ? numberValue as FieldSyncProcessBatchLimit
    : 25;
}
