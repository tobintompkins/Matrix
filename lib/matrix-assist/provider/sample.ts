import type {
  DiagnosticInput,
  DiagnosticResponse,
  ServiceHistoryInput,
  ServiceHistorySummary,
  ServiceNotesDraft,
  ServiceNotesInput,
} from "../types";
import type { AiAssistantProvider } from "./types";
import { SAFETY_NOTES } from "./types";

/**
 * Deterministic development-only provider.
 * Clearly marked as sample — never presented as live AI.
 */
export class SampleAssistProvider implements AiAssistantProvider {
  readonly name = "sample";
  readonly isSample = true;

  async generateDiagnosticGuidance(
    input: DiagnosticInput,
  ): Promise<DiagnosticResponse> {
    const symptom = input.symptom.trim() || "unspecified symptom";
    const checks =
      input.templateSteps && input.templateSteps.length > 0
        ? input.templateSteps.map((s) => ({
            title: s.title,
            instructions: s.instructions ?? "Inspect and record findings.",
          }))
        : [
            {
              title: "Confirm error presentation",
              instructions:
                "Reproduce the symptom and note when it occurs (startup, mid-job, specific tray).",
            },
            {
              title: "Inspect paper path / feed path",
              instructions:
                "Check rollers, guides, and sensors in the reported jam or feed area.",
            },
            {
              title: "Review recent parts and PM",
              instructions:
                "Compare meter growth and last related part replacement against current symptom.",
            },
            {
              title: "Test after cleaning or reseating",
              instructions:
                "Clean accessible feed surfaces if contaminated; reseat connectors only when powered down.",
            },
          ];

    const modelSpecificNote = input.hasVerifiedModelProcedure
      ? undefined
      : "No verified model-specific procedure is currently available. The following is general troubleshooting guidance.";

    return {
      symptomConfirmation: [
        `Reported / observed: ${symptom}`,
        input.observations
          ? `Technician observation: ${input.observations}`
          : "Confirm whether the issue is intermittent.",
        input.errorCode
          ? `Error code provided: ${input.errorCode}`
          : "No error code provided yet.",
        "Note paper type, tray, and whether the machine was restarted.",
      ],
      safetyNotes: [...SAFETY_NOTES],
      inspectionChecks: checks,
      likelyCauses: [
        {
          title: "Contaminated or worn feed components",
          confidence: "Moderate",
          reason:
            "Symptom language and common field patterns suggest feed-path wear or contamination; confirm with inspection.",
        },
        {
          title: "Sensor obstruction or misalignment",
          confidence: "Low",
          reason:
            "Possible when jams or errors recur after restart; requires on-machine verification.",
        },
      ],
      recommendedActions: [
        { type: "Inspect", detail: "Inspect the reported assembly first." },
        { type: "Clean", detail: "Clean rollers/guides if contaminated." },
        {
          type: "Compare with service history",
          detail: "Review linked prior calls for repeat symptoms.",
        },
        {
          type: "Test",
          detail: "Run a controlled feed/print test after corrective action.",
        },
      ],
      evidence:
        input.evidence.length > 0
          ? input.evidence
          : [
              {
                label: "Based on the current technician observation only.",
                kind: "observation",
              },
            ],
      summary: `[DEVELOPMENT SAMPLE] Structured guidance for: ${symptom}`,
      modelSpecificNote,
      isSample: true,
      isUnverifiedInterpretation: !input.errorCode
        ? false
        : true,
    };
  }

  async summarizeServiceHistory(
    input: ServiceHistoryInput,
  ): Promise<ServiceHistorySummary> {
    if (input.records.length === 0) {
      return {
        bullets: ["No related service-history records were available to summarize."],
        evidence: [],
        isSample: true,
      };
    }
    const bullets = [
      `${input.records.length} related service record(s) were reviewed.`,
      ...input.records.slice(0, 4).map(
        (r) => `${r.label}${r.date ? ` (${r.date})` : ""}: ${r.detail}`,
      ),
    ];
    return {
      bullets,
      evidence: input.records.map((r) => ({
        label: r.label,
        href: r.href,
        kind: "service_call" as const,
      })),
      isSample: true,
    };
  }

  async draftServiceNotes(input: ServiceNotesInput): Promise<ServiceNotesDraft> {
    const sections = [
      {
        heading: "Customer Complaint",
        body: input.customerComplaint?.trim() || "Not provided.",
      },
      {
        heading: "Inspection Performed",
        body: input.inspection?.trim() || "Not provided.",
      },
      {
        heading: "Corrective Action",
        body: [
          input.partsCleaned ? `Cleaned: ${input.partsCleaned}` : null,
          input.partsReplaced ? `Replaced: ${input.partsReplaced}` : null,
          input.adjustments ? `Adjustments: ${input.adjustments}` : null,
        ]
          .filter(Boolean)
          .join("\n") || "Not provided.",
      },
      {
        heading: "Testing and Verification",
        body: input.tests?.trim() || "Not provided.",
      },
      {
        heading: "Final Machine Status",
        body: input.machineStatus?.trim() || input.finalResult?.trim() || "Not provided.",
      },
      {
        heading: "Recommended Follow-Up",
        body: input.followUp?.trim() || "None noted.",
      },
    ];
    return {
      sections,
      fullText: sections.map((s) => `${s.heading}\n${s.body}`).join("\n\n"),
      isSample: true,
      label: "AI-generated draft — review before saving",
    };
  }
}
