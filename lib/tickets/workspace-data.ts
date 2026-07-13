import type { AttachmentPlaceholder, TicketWorkspace } from "./workspace-types";

export const ticketWorkspaces: TicketWorkspace[] = [
  {
    ticketNumber: "TKT-2026-0142",
    customer: "SFX / MPX",
    printerModel: "GD9630",
    assetId: "MX-GD-002",
    serialNumber: "GD9630-2024-00842",
    status: "Open",
    priority: "High",
    assignedTechnician: "Mike Reynolds",
    dateOpened: "2026-07-05",
    problemDescription:
      "Customer reports recurring paper jams from Tray 2 during high-volume production runs. Jam occurs approximately every 200–300 sheets. Operator has cleaned the tray and reloaded paper twice. Issue started after switching to a heavier stock (24 lb). No error codes displayed on panel, but jam sensor triggers consistently at the feed roller area.",
    travelTime: "0h 45m",
    repairTime: "1h 15m",
    totalTime: "2h 00m",
    printerSlug: "mx-gd-002",
  },
  {
    ticketNumber: "TKT-2026-0138",
    customer: "SFX / MPX",
    printerModel: "Valezus",
    assetId: "MX-VA-002",
    serialNumber: "VAL-2023-01567",
    status: "In Progress",
    priority: "High",
    assignedTechnician: "Toby Tompkins",
    dateOpened: "2026-07-04",
    problemDescription:
      "Black marks appearing on the leading edge of printed sheets, most visible on light coverage jobs. Customer noticed issue after approximately 15,000 impressions since last service. Marks are consistent across all trays. Suspected drum or cleaning blade wear.",
    travelTime: "1h 10m",
    repairTime: "2h 30m",
    totalTime: "3h 40m",
    printerSlug: "mx-va-002",
  },
  {
    ticketNumber: "TKT-2026-0135",
    customer: "SFX / MPX",
    printerModel: "GL9730",
    assetId: "MX-GL-001",
    serialNumber: "GL9730-2024-00321",
    status: "Open",
    priority: "Medium",
    assignedTechnician: "Sarah Chen",
    dateOpened: "2026-07-03",
    problemDescription:
      "Registration alignment issue on duplex output — image shifts approximately 1.5mm between front and back sides. Single-sided output is within spec. Customer reports issue worsened after media type change. Calibration attempted via operator panel without improvement.",
    travelTime: "0h 30m",
    repairTime: "0h 45m",
    totalTime: "1h 15m",
    printerSlug: "mx-gl-001",
  },
];

export const attachmentPlaceholders: AttachmentPlaceholder[] = [
  {
    id: "photos",
    label: "Photos",
    description: "Upload jam site, roller wear, or error screen captures.",
  },
  {
    id: "pdfs",
    label: "PDFs",
    description: "Attach service reports, invoices, or site documentation.",
  },
  {
    id: "manuals",
    label: "Service Manuals",
    description: "Link relevant RISO technical documentation.",
  },
  {
    id: "customer-docs",
    label: "Customer Documents",
    description: "Contracts, SLAs, or customer-provided reference files.",
  },
];

export function getTicketByNumber(ticketNumber: string): TicketWorkspace | undefined {
  return ticketWorkspaces.find((t) => t.ticketNumber === ticketNumber);
}
