import { getAiProviderName } from "../config";
import type { AiAssistantProvider } from "./types";
import { SampleAssistProvider } from "./sample";
import { OpenAiCompatibleProvider } from "./openai-compatible";

export type { AiAssistantProvider } from "./types";
export { SAFETY_NOTES } from "./types";

export function getAiAssistantProvider(): AiAssistantProvider | null {
  const name = getAiProviderName();
  if (name === "none") return null;
  if (name === "sample") return new SampleAssistProvider();
  return new OpenAiCompatibleProvider();
}
