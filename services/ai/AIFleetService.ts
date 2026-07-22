/**
 * Patch 51A.1 — AI fleet analysis service (demo insights; no LLM).
 */

import { aiConfig } from "@/config/ai";
import type { AiFleetInsight } from "@/lib/ai/types";
import { logAiRequest } from "./logging";

const DEMO_INSIGHTS: AiFleetInsight[] = [
  {
    id: "fleet-valezus-util",
    title: "Valezus fleet utilization high",
    summary:
      "Valezus segment utilization is elevated versus regional baseline. Schedule capacity review.",
    confidence: 94,
    fleetSegment: "Valezus",
  },
  {
    id: "fleet-comcolor-trend",
    title: "ComColor repeat service trend",
    summary:
      "Repeat service pattern detected on ComColor units at SFX/MPX demo sites.",
    confidence: 91,
    fleetSegment: "ComColor",
  },
];

export class AIFleetService {
  async analyze(userId?: string): Promise<AiFleetInsight[]> {
    const started = Date.now();
    if (userId) {
      await logAiRequest({
        userId,
        requestType: "FLEET_ANALYSIS",
        question: "Analyze fleet utilization",
        response: JSON.stringify({ count: DEMO_INSIGHTS.length }),
        confidence: aiConfig.defaultConfidence,
        executionTime: Date.now() - started,
      });
    }
    return DEMO_INSIGHTS;
  }
}

export const aiFleetService = new AIFleetService();
