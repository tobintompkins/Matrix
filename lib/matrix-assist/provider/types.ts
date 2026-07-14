import type {
  DiagnosticInput,
  DiagnosticResponse,
  ServiceHistoryInput,
  ServiceHistorySummary,
  ServiceNotesDraft,
  ServiceNotesInput,
} from "../types";

export interface AiAssistantProvider {
  readonly name: string;
  readonly isSample: boolean;
  generateDiagnosticGuidance(
    input: DiagnosticInput,
  ): Promise<DiagnosticResponse>;
  summarizeServiceHistory(
    input: ServiceHistoryInput,
  ): Promise<ServiceHistorySummary>;
  draftServiceNotes(input: ServiceNotesInput): Promise<ServiceNotesDraft>;
}

export const SAFETY_NOTES = [
  "Follow manufacturer safety procedures.",
  "Power down equipment where required.",
  "Disconnect power before accessing electrical components.",
  "Allow hot components to cool.",
  "Use required PPE.",
  "Do not bypass interlocks or safety systems.",
  "Confirm moving assemblies have stopped.",
];
