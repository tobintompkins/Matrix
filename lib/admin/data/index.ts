/**
 * Patch 49B — Data Administration barrel.
 */

export * from "./types";
export * from "./deletion-reasons";
export * from "./operational-state";
export * from "./relationship-impact";
export * from "./service-calls";
export * from "./customers";
export * from "./machines";
export * from "./pm";
export * from "./meters";
export * from "./inventory";
export * from "./deleted-records";
export * from "./archived-records";
export {
  previewPermanentDeletion,
  permanentlyDeleteAdminRecord,
} from "./permanent-delete";
export type {
  DeletionPreviewResult,
  PermanentDeletePreview,
} from "./permanent-delete";
export * from "./bulk";
