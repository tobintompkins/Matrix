/**
 * Patch 49B — Operational Data Administration types.
 */

export type AdminRecordType =
  | "SERVICE_CALL"
  | "CUSTOMER"
  | "MACHINE"
  | "PM_SCHEDULE"
  | "PM_HISTORY"
  | "METER"
  | "PART"
  | "WAREHOUSE";

export type AdminRecordLifecycle = "ACTIVE" | "ARCHIVED" | "DELETED";

export type AdminRecordStateLabel =
  | "Active"
  | "Archived"
  | "Deleted"
  | "Protected"
  | "Completed"
  | "Locked"
  | "Requires Review"
  | "Invalid"
  | "Retired";

export type DeletionReasonKey =
  | "DUPLICATE_RECORD"
  | "CREATED_IN_ERROR"
  | "TEST_RECORD"
  | "INCORRECT_CUSTOMER"
  | "INCORRECT_MACHINE"
  | "INCORRECT_ASSOCIATION"
  | "DATA_CLEANUP"
  | "IMPORTED_IN_ERROR"
  | "CUSTOMER_REQUEST"
  | "OTHER";

export type AdminOperationalState = {
  recordType: AdminRecordType;
  recordId: string;
  lifecycle: AdminRecordLifecycle;
  organizationId: string;
  deletedAt?: string | null;
  deletedByUserId?: string | null;
  deletedByName?: string | null;
  deletionReason?: DeletionReasonKey | string | null;
  deletionNotes?: string | null;
  archivedAt?: string | null;
  archivedByUserId?: string | null;
  archivedByName?: string | null;
  archiveReason?: string | null;
  previousLifecycle?: AdminRecordLifecycle | null;
  isInvalid?: boolean;
  invalidatedAt?: string | null;
  invalidatedByUserId?: string | null;
  invalidationReason?: string | null;
  mergedIntoId?: string | null;
  displayName?: string | null;
  customerName?: string | null;
  machineName?: string | null;
  updatedAtVersion: number;
  updatedAt: string;
};

export type RelationshipImpactItem = {
  category: string;
  count: number;
  blocking?: boolean;
  detail?: string;
};

export type RelationshipImpact = {
  recordType: AdminRecordType;
  recordId: string;
  items: RelationshipImpactItem[];
  canArchive: boolean;
  canSoftDelete: boolean;
  canRestore: boolean;
  canPermanentlyDelete: boolean;
  blockers: string[];
};

export type AdminCorrectionField = {
  field: string;
  label: string;
  currentValue: string;
  proposedValue: string;
};

export type BulkAdminAction =
  | "ARCHIVE"
  | "UNARCHIVE"
  | "SOFT_DELETE"
  | "ASSIGN_REGION"
  | "ASSIGN_TECHNICIAN"
  | "CHANGE_ACTIVE_STATUS"
  | "EXPORT";

export const BULK_MAX_BATCH_SIZE = 25;

export const DEFAULT_SOFT_DELETE_RETENTION_DAYS = 30;

export const PERMANENT_DELETE_ENABLED_BY_DEFAULT = false;
