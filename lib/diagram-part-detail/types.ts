export type PartStatus = "In Stock" | "Low Stock" | "Order Required" | "Discontinued";

export type DiagramPartDetail = {
  partName: string;
  partNumber: string;
  compatibleModel: string;
  assembly: string;
  calloutNumber: string;
  status: PartStatus;
  diagramName: string;
  description: string;
  quantityNormallyRequired: number;
  compatibleModels: string[];
  relatedPmKit: string;
  commonReplacementReason: string;
  notes: string;
  inventory: {
    currentStock: number;
    reorderLevel: number;
    onOrder: number;
    needToOrderQuantity: number;
  };
};
