/**
 * Patch 51B.1 — Matrix Assist customer-support mode (restricted).
 * Deterministic / sample-safe. Does not change records or claim repairs complete.
 */

/** Spec §11 — explicit audience for Assist requests. */
export type MatrixAssistAudience = "internal" | "technician" | "customer";

export type CustomerAssistRequest = {
  question: string;
  machineLabel?: string;
  ticketStatus?: string;
  audience?: MatrixAssistAudience;
};

export type CustomerAssistAnswer = {
  answer: string;
  audience: MatrixAssistAudience;
  safeChecks: string[];
  nextSteps: Array<{ label: string; href: string }>;
  observed: string[];
  restrictions: string[];
  isSample: boolean;
  provider: string;
  model: string;
  generatedAt: string;
};

const FORBIDDEN_PATTERNS = [
  /internal note/i,
  /labor cost/i,
  /parts cost/i,
  /vendor/i,
  /margin/i,
  /warranty recovery/i,
  /employee performance/i,
  /replace the drum unit by removing/i,
];

export function assertCustomerAssistSafe(text: string): boolean {
  return !FORBIDDEN_PATTERNS.some((p) => p.test(text));
}

export function answerCustomerAssist(
  input: CustomerAssistRequest,
): CustomerAssistAnswer {
  const audience: MatrixAssistAudience =
    input.audience === "customer" || !input.audience
      ? "customer"
      : input.audience;

  if (audience !== "customer") {
    return {
      answer:
        "This endpoint is customer-mode only. Use the technician Matrix Assist workspace for internal guidance.",
      audience,
      safeChecks: [],
      nextSteps: [{ label: "Matrix Assist", href: "/ai-technician" }],
      observed: [],
      restrictions: ["Customer-mode endpoint rejected non-customer audience."],
      isSample: true,
      provider: "matrix-local",
      model: "customer-assist-v1",
      generatedAt: new Date().toISOString(),
    };
  }

  const q = (input.question || "").trim() || "How do I get help with my printer?";
  const machine = input.machineLabel?.trim();
  const status = input.ticketStatus?.trim();

  const observed: string[] = [];
  if (machine) observed.push(`Selected machine: ${machine}`);
  if (status) observed.push(`Ticket status shown to you: ${status}`);

  let answer = "";
  const safeChecks: string[] = [];
  const nextSteps: CustomerAssistAnswer["nextSteps"] = [];

  if (/status|ticket|request/i.test(q) && status) {
    answer = `Your service request currently shows as “${status}”. This is a customer-safe status summary. The service team updates it as work progresses.`;
    nextSteps.push({
      label: "View my service requests",
      href: "/portal/tickets",
    });
  } else if (/part|toner|supply/i.test(q)) {
    answer =
      "You can request supplies or parts from the portal Parts page. Pricing, vendor details, and warehouse quantities are not shown in customer mode.";
    safeChecks.push("Confirm the machine serial number on the equipment label.");
    safeChecks.push("Note the supply type or part description you need.");
    nextSteps.push({ label: "Request parts", href: "/portal/parts" });
  } else if (/pm|preventive|maintenance schedule/i.test(q)) {
    answer =
      "Preventive maintenance dates and due status are available on the PM page for your authorized machines.";
    nextSteps.push({
      label: "View PM schedule",
      href: "/portal/maintenance",
    });
  } else if (/down|error|jam|won't print|will not print|problem/i.test(q)) {
    answer =
      "I can help you describe the problem and choose the right machine, then guide you to submit a service request. I cannot perform repairs or mark work complete.";
    safeChecks.push("Check that the printer is powered on and shows a ready/idle screen.");
    safeChecks.push("Confirm paper trays are loaded and doors/covers are fully closed.");
    safeChecks.push("If a message appears on the panel, write it down exactly.");
    safeChecks.push("Do not attempt internal service procedures reserved for trained technicians.");
    nextSteps.push({ label: "Request service", href: "/portal/tickets/new" });
    nextSteps.push({ label: "Select a machine", href: "/portal/printers" });
  } else if (/manual|document|guide/i.test(q)) {
    answer =
      "Customer-approved manuals and documents are listed under Documents when your service provider has published them for your account.";
    nextSteps.push({ label: "View documents", href: "/portal/documents" });
  } else {
    answer =
      "I’m the Matrix Assist customer support helper. I can help describe problems, suggest basic checks, explain ticket status, and direct you to submit service or parts requests. I will not change records or claim a repair is complete.";
    nextSteps.push({ label: "Request service", href: "/portal/tickets/new" });
    nextSteps.push({ label: "Open dashboard", href: "/portal/dashboard" });
  }

  const restrictions = [
    "Does not reveal internal service procedures for trained technicians only",
    "Does not reveal confidential notes, costs, or restricted inventory data",
    "Does not change records without authorization",
    "Does not claim a repair is complete",
  ];

  const payload: CustomerAssistAnswer = {
    answer,
    audience: "customer",
    safeChecks,
    nextSteps,
    observed,
    restrictions,
    isSample: true,
    provider: "matrix-local",
    model: "customer-assist-v1",
    generatedAt: new Date().toISOString(),
  };

  if (!assertCustomerAssistSafe(JSON.stringify(payload))) {
    return {
      ...payload,
      answer:
        "I can only provide customer-safe guidance. Please submit a service request for technician support.",
      safeChecks: [],
    };
  }

  return payload;
}
