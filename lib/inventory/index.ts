export type {
  EnterpriseInventoryLocation,
  EnterpriseLocationType,
  GuidedDiagramPartLookup,
  InventoryDashboardMetrics,
  InventoryReservation,
  InventoryTransaction,
  InventoryTxnType,
  PartCatalogItem,
  PartCatalogStatus,
  PurchaseRequest,
  PurchaseRequestLine,
  PurchaseRequestStatus,
  ReservationPurpose,
  ScanAction,
  ScanRequest,
  ScanResult,
  StockBalance,
  VendorProfile,
} from "./enterprise-types";

export { quantityAvailable } from "./enterprise-types";

export {
  aggregateBalancesByPart,
  buildDashboardMetrics,
  inventoryValue,
  isBackordered,
  isLowStock,
  isOutOfStock,
  searchCatalog,
  truckStockSummary,
  usageByPart,
} from "./enterprise-calculations";

export {
  applyInventoryTransaction,
  canTransitionPurchaseRequest,
  consumeReservation,
  createPartCatalogItem,
  createReservation,
  findOrCreateBalance,
  nextPurchaseRequestNumber,
  releaseReservation,
  transitionPurchaseRequest,
} from "./enterprise-operations";

export {
  createCatalogPart,
  createPurchaseRequest,
  findPartByNumber,
  generateInventoryReport,
  getCatalogPart,
  getDashboardMetrics,
  getTruckStock,
  listAuditLog,
  listBalances,
  listCatalog,
  listLocations,
  listPurchaseRequests,
  listReservations,
  listTransactions,
  listVendors,
  lookupGuidedDiagramPart,
  postTransaction,
  processScan,
  releasePartReservation,
  reservePart,
  resetEnterpriseInventoryForTests,
  updatePurchaseRequestStatus,
  type InventoryReportType,
} from "./enterprise-repository";

// Existing foundation exports (Patch inventory UI)
export type {
  CompatibleModel,
  EmergencyStockRequest,
  InventoryItem,
  InventoryLocation,
  InventoryLocationType,
  InventoryTransfer,
  InventoryTransferStatus,
  PartsOrderDraftLine,
  StockStatus,
} from "./types";
export {
  compatibleModels,
  getDefaultTruckLocation,
  getDefaultWarehouseLocation,
  inventoryLocations,
  sampleInventoryItems,
} from "./data";
export {
  createDraftTransfer,
  createPartsOrderDraftLine,
  createServiceCallPartsOrderDraftLine,
  deriveStockStatus,
  INVENTORY_INTEGRATION_PLACEHOLDERS,
  isLowOrOutOfStock,
  withDerivedStatus,
} from "./helpers";
