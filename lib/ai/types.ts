/**
 * Patch 51A.1 Part 1 — Shared AI Operations Center DTOs / interfaces.
 */

export type AiSessionStatus = "ACTIVE" | "IDLE" | "CLOSED";

export type AiSession = {
  id: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
  sessionName: string;
  status: AiSessionStatus;
  lastActivity: string;
  requestCount: number;
  averageConfidence: number;
  averageResponseTime: number;
};

export type AiLog = {
  id: string;
  createdAt: string;
  userId: string;
  sessionId: string | null;
  requestType: string;
  question: string;
  response: string;
  confidence: number;
  executionTime: number;
  success: boolean;
  metadata: Record<string, unknown> | null;
};

export type AiPredictionStatus = "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "EXPIRED";
export type AiPredictionPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type AiPrediction = {
  id: string;
  createdAt: string;
  predictionType: string;
  title: string;
  description: string;
  confidence: number;
  priority: AiPredictionPriority;
  status: AiPredictionStatus;
  recommendedAction: string;
  expiresAt: string | null;
};

export type AiNotificationSeverity = "INFO" | "WARNING" | "CRITICAL";

export type AiNotification = {
  id: string;
  createdAt: string;
  title: string;
  message: string;
  severity: AiNotificationSeverity;
  read: boolean;
  category: string;
  actionUrl: string | null;
};

export type AiLearningStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

export type AiLearningRun = {
  id: string;
  createdAt: string;
  source: string;
  recordsProcessed: number;
  status: AiLearningStatus;
  duration: number;
  notes: string | null;
};

export type AiMetric = {
  id: string;
  createdAt: string;
  metricName: string;
  metricValue: number;
  metricUnit: string;
};

export type AiRecommendationPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type AiRecommendation = {
  id: string;
  createdAt: string;
  title: string;
  description: string;
  priority: AiRecommendationPriority;
  category: string;
  completed: boolean;
  confidence: number;
};

export type AiStatus = {
  online: boolean;
  version: string;
  uptime: number;
  learningEnabled: boolean;
  confidence: number;
  responseTime: number;
  chatEnabled: boolean;
  predictionEngineEnabled: boolean;
  recommendationsEnabled: boolean;
};

export type AiSummary = {
  title: string;
  serviceCalls: number;
  completedPms: number;
  inventoryAlerts: number;
  averageTechnicianUtilization: number;
  openIncidents: number;
  generatedAt: string;
};

export type AiHealth = {
  status: "HEALTHY" | "DEGRADED" | "OFFLINE";
  checks: Array<{ name: string; ok: boolean; detail: string }>;
  lastCheckedAt: string;
};

export type AiChatRequest = {
  question: string;
  sessionId?: string | null;
  userId?: string;
};

export type AiChatResponse = {
  success: boolean;
  answer: string;
  confidence: number;
  sessionId: string | null;
  executionTimeMs: number;
  placeholder: true;
};

export type AiFleetInsight = {
  id: string;
  title: string;
  summary: string;
  confidence: number;
  fleetSegment: string;
};

export type AiInsight = {
  id: string;
  title: string;
  body: string;
  category: string;
  confidence: number;
};
