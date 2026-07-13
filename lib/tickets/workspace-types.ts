export type TicketWorkspace = {
  ticketNumber: string;
  customer: string;
  printerModel: string;
  assetId: string;
  serialNumber: string;
  status: string;
  priority: string;
  assignedTechnician: string;
  dateOpened: string;
  problemDescription: string;
  travelTime: string;
  repairTime: string;
  totalTime: string;
  printerSlug: string;
};

export type AttachmentPlaceholder = {
  id: string;
  label: string;
  description: string;
};
