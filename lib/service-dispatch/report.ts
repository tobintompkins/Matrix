import type {
  CustomerVisibleTicket,
  DiagnosticRecord,
  ServiceReportPayload,
  TicketLaborEntry,
  TicketUpdate,
} from "./types";

export function emptyDiagnostic(): DiagnosticRecord {
  return {
    reportedSymptom: "",
    confirmedSymptom: "",
    errorCode: "",
    rootCause: "",
    diagnosticSteps: "",
    componentsInspected: "",
    partsTested: "",
    firmwareChecked: "",
    networkTests: "",
    correctiveAction: "",
    testPrintsCompleted: false,
    finalOperatingCondition: "",
    additionalRecommendations: "",
    templateId: null,
  };
}

export function diagnosticToResolutionSummary(d: DiagnosticRecord): string {
  const parts = [
    d.confirmedSymptom && `Confirmed: ${d.confirmedSymptom}`,
    d.rootCause && `Root cause: ${d.rootCause}`,
    d.correctiveAction && `Corrective action: ${d.correctiveAction}`,
    d.finalOperatingCondition && `Final condition: ${d.finalOperatingCondition}`,
    d.additionalRecommendations && `Recommendations: ${d.additionalRecommendations}`,
  ].filter(Boolean);
  return parts.join("\n");
}

export function buildServiceReport(input: {
  ticketNumber: string;
  customer: string;
  location: string;
  printerModel: string;
  serialNumber: string;
  openedAt: string;
  completedAt: string;
  technician: string;
  reportedProblem: string;
  diagnosis: DiagnosticRecord | string;
  workPerformed: string;
  partsUsed: Array<{ partNumber: string; description: string; quantity: number }>;
  meterCount: number | null;
  labor: TicketLaborEntry[];
  testResults: string;
  recommendations: string;
  customerSignature: string;
  technicianSignature: string;
  followUp: string;
  warrantyStatus: string;
}): ServiceReportPayload {
  const diagnosis =
    typeof input.diagnosis === "string"
      ? input.diagnosis
      : diagnosticToResolutionSummary(input.diagnosis);

  const travelMinutes = input.labor
    .filter((l) => l.laborType === "TRAVEL")
    .reduce((s, l) => s + l.laborMinutes, 0);
  const laborMinutes = input.labor
    .filter((l) => l.laborType !== "TRAVEL")
    .reduce((s, l) => s + l.laborMinutes, 0);

  return {
    ticketNumber: input.ticketNumber,
    customer: input.customer,
    location: input.location,
    printerModel: input.printerModel,
    serialNumber: input.serialNumber,
    openedAt: input.openedAt,
    completedAt: input.completedAt,
    technician: input.technician,
    reportedProblem: input.reportedProblem,
    diagnosis,
    workPerformed: input.workPerformed,
    partsUsed: input.partsUsed,
    meterCount: input.meterCount,
    laborMinutes,
    travelMinutes,
    testResults: input.testResults,
    recommendations: input.recommendations,
    customerSignature: input.customerSignature,
    technicianSignature: input.technicianSignature,
    followUp: input.followUp,
    warrantyStatus: input.warrantyStatus,
  };
}

export function renderServiceReportHtml(report: ServiceReportPayload): string {
  const partsRows = report.partsUsed
    .map(
      (p) =>
        `<tr><td>${escapeHtml(p.partNumber)}</td><td>${escapeHtml(p.description)}</td><td>${p.quantity}</td></tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Service Report ${escapeHtml(report.ticketNumber)}</title>
<style>
  body{font-family:Segoe UI,system-ui,sans-serif;color:#0f172a;margin:24px;line-height:1.45}
  h1{font-size:22px;margin:0 0 4px}
  .brand{color:#0891b2;font-weight:700;letter-spacing:.04em}
  .meta{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;margin:16px 0;font-size:14px}
  .section{margin-top:18px}
  .section h2{font-size:14px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;margin:0 0 6px}
  table{width:100%;border-collapse:collapse;font-size:14px}
  th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:left}
  th{background:#f1f5f9}
  .sig{margin-top:12px;border-top:1px solid #94a3b8;padding-top:8px;min-height:48px}
  @media print{body{margin:12mm}}
</style>
</head>
<body>
  <div class="brand">MATRIX</div>
  <h1>Service Report</h1>
  <p>${escapeHtml(report.ticketNumber)} · Warranty: ${escapeHtml(report.warrantyStatus)}</p>
  <div class="meta">
    <div><strong>Customer</strong><br/>${escapeHtml(report.customer)}</div>
    <div><strong>Location</strong><br/>${escapeHtml(report.location)}</div>
    <div><strong>Printer</strong><br/>${escapeHtml(report.printerModel)} · ${escapeHtml(report.serialNumber)}</div>
    <div><strong>Technician</strong><br/>${escapeHtml(report.technician)}</div>
    <div><strong>Opened</strong><br/>${escapeHtml(report.openedAt.slice(0, 19))}</div>
    <div><strong>Completed</strong><br/>${escapeHtml(report.completedAt.slice(0, 19) || "—")}</div>
    <div><strong>Meter</strong><br/>${report.meterCount ?? "—"}</div>
    <div><strong>Labor / Travel</strong><br/>${report.laborMinutes} / ${report.travelMinutes} min</div>
  </div>
  <div class="section"><h2>Reported problem</h2><p>${escapeHtml(report.reportedProblem)}</p></div>
  <div class="section"><h2>Diagnosis</h2><p>${escapeHtml(report.diagnosis)}</p></div>
  <div class="section"><h2>Work performed</h2><p>${escapeHtml(report.workPerformed)}</p></div>
  <div class="section"><h2>Parts used</h2>
    <table><thead><tr><th>Part #</th><th>Description</th><th>Qty</th></tr></thead>
    <tbody>${partsRows || "<tr><td colspan=3>None</td></tr>"}</tbody></table>
  </div>
  <div class="section"><h2>Test results</h2><p>${escapeHtml(report.testResults || "—")}</p></div>
  <div class="section"><h2>Recommendations</h2><p>${escapeHtml(report.recommendations || "—")}</p></div>
  <div class="section"><h2>Follow-up</h2><p>${escapeHtml(report.followUp || "None")}</p></div>
  <div class="section"><h2>Customer signature</h2><div class="sig">${escapeHtml(report.customerSignature || "—")}</div></div>
  <div class="section"><h2>Technician signature</h2><div class="sig">${escapeHtml(report.technicianSignature || "—")}</div></div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function toCustomerVisibleTicket(input: {
  ticketNumber: string;
  printer: string;
  problemDescription: string;
  status: string;
  technicianName: string;
  scheduledStart: string;
  scheduledEnd: string;
  estimatedArrival: string;
  partsDelay: string;
  resolutionSummary: string;
  updates: TicketUpdate[];
}): CustomerVisibleTicket {
  return {
    ticketNumber: input.ticketNumber,
    printer: input.printer,
    problemDescription: input.problemDescription,
    status: input.status,
    technicianName: input.technicianName,
    scheduledWindow:
      input.scheduledStart && input.scheduledEnd
        ? `${input.scheduledStart.slice(0, 16)} – ${input.scheduledEnd.slice(0, 16)}`
        : "",
    estimatedArrival: input.estimatedArrival,
    partsDelay: input.partsDelay,
    resolutionSummary: input.resolutionSummary,
    updates: input.updates
      .filter((u) => u.visibleToCustomer)
      .map((u) => ({ message: u.message, at: u.createdAt })),
  };
}

/** Strip fields customers must never see. */
export function redactInternalTicketFields<T extends Record<string, unknown>>(
  ticket: T,
): Partial<T> {
  const blocked = new Set([
    "internalNotes",
    "privateNotes",
    "laborCost",
    "managementDiscussion",
    "inventoryLocation",
    "securityNotes",
  ]);
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(ticket)) {
    if (!blocked.has(k)) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}
