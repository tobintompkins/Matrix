export { isClerkConfigured } from "./clerk-config";

export type {
  MatrixAuthContext,
  MatrixOrganization,
  MatrixOrganizationSlug,
  MatrixPermission,
  MatrixRole,
  MatrixUserProfile,
} from "./types";

export {
  DEV_FALLBACK_ROLE,
  MATRIX_ORGANIZATION_PLACEHOLDERS,
} from "./types";

export {
  canAccessRoute,
  getDefaultPermissionsForRole,
  hasMatrixPermission,
  resolveMatrixRole,
} from "./permissions";

export {
  canAdjustInventory,
  canApprovePurchaseRequests,
  canConfigureInventory,
  canConsumeInventory,
  canCountTruckInventory,
  canReceiveInventory,
  canRequestParts,
  canReserveInventory,
  canTransferInventory,
  canViewInventory,
  canViewInventoryReports,
  INVENTORY_PERMISSIONS,
} from "./inventory-permissions";

export {
  canApproveCycleCounts,
  canApproveInventoryTransfers,
  canDeleteInventoryRecords,
  canExportInventory,
  canManageWarehouses,
  canPrintInventoryReports,
  canRunReceivingWizard,
  canViewInventoryCosts,
  WAREHOUSE_PERMISSIONS,
} from "./warehouse-permissions";

export {
  canConfigureOfflinePolicies,
  canDownloadOfflinePackages,
  canResolveFieldConflicts,
  canSyncFieldQueue,
  canUseOfflineField,
  canViewField,
  canViewOtherTechniciansField,
  FIELD_PERMISSIONS,
} from "./field-permissions";

export {
  canManageAssets,
  canManageContacts,
  canManageContracts,
  canManageCustomers,
  canManageSites,
  canManageWarranties,
  canUpdateAssetServiceInfo,
  canViewCustomers,
  canViewSites,
  CRM_PERMISSIONS,
} from "./crm-permissions";

export {
  canConfigureEscalation,
  canConfigureSla,
  canConfigureTicketCategories,
  canCreateCustomerPortalTicket,
  canDispatchTickets,
  canViewCustomerPortalTickets,
  canViewDispatchBoard,
  DISPATCH_PERMISSIONS,
} from "./dispatch-permissions";

export {
  canAccessPortal,
  canAdministerPortal,
  canManagePortalUsers,
  PORTAL_PERMISSIONS,
} from "./portal-permissions";

export {
  canImportMeterCounts,
  canManagePmSettings,
  canOverrideMeterValidation,
  canViewPmExecutive,
  canViewPmForecasting,
  canViewPmIntelligence,
  PM_INTELLIGENCE_PERMISSIONS,
} from "./pm-intelligence-permissions";

export {
  getPermissionsForProfile,
  requireMatrixAuth,
  requireMatrixPermission,
} from "./server";
