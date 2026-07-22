/**
 * Patch 51A.1 — AI chat stub (no OpenAI / provider connection).
 */

import { prisma } from "@/lib/db/prisma";
import { aiConfig } from "@/config/ai";
import type { AiChatRequest, AiChatResponse } from "@/lib/ai/types";
import { logAiRequest } from "./logging";

export class AIChatService {
  isEnabled(): boolean {
    return aiConfig.chatEnabled;
  }

  async ask(input: AiChatRequest): Promise<AiChatResponse> {
    const started = Date.now();
    const userId = input.userId ?? "system";
    let sessionId = input.sessionId ?? null;

    if (!sessionId) {
      const session = await prisma.aiOpsSession.create({
        data: {
          userId,
          sessionName: `Session ${new Date().toISOString().slice(0, 16)}`,
          status: "ACTIVE",
        },
      });
      sessionId = session.id;
    }

    const answer = "AI service placeholder";
    const confidence = aiConfig.defaultConfidence;
    const executionTimeMs = Date.now() - started;

    await logAiRequest({
      userId,
      sessionId,
      requestType: "CHAT",
      question: input.question,
      response: answer,
      confidence,
      executionTime: executionTimeMs,
      success: true,
      metadata: {
        placeholder: true,
        chatEnabled: aiConfig.chatEnabled,
      },
    });

    return {
      success: true,
      answer,
      confidence,
      sessionId,
      executionTimeMs,
      placeholder: true,
    };
  }
}

export const aiChatService = new AIChatService();
