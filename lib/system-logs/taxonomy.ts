/**
 * Patch 50C-2 — Event taxonomy for System Logs (normalized over AuditLog).
 */

export const SYSTEM_LOG_CATEGORIES = [
  "AUDIT",
  "SECURITY",
  "AUTHENTICATION",
  "AUTHORIZATION",
  "USER_ACTIVITY",
  "DATA_CHANGE",
  "API",
  "APPLICATION",
  "ERROR",
  "BACKGROUND_JOB",
  "IMPORT",
  "EXPORT",
  "INTEGRATION",
  "WEBHOOK",
  "NOTIFICATION",
  "APPROVAL",
  "CUSTOMER_PORTAL",
  "DATA_QUALITY",
  "CONFIGURATION",
  "SYSTEM",
  "PERFORMANCE",
] as const;

export type SystemLogCategory = (typeof SYSTEM_LOG_CATEGORIES)[number];

export const SYSTEM_LOG_SEVERITIES = [
  "CRITICAL",
  "ERROR",
  "WARNING",
  "NOTICE",
  "INFO",
  "DEBUG",
] as const;

export type SystemLogSeverity = (typeof SYSTEM_LOG_SEVERITIES)[number];

export const SYSTEM_LOG_OUTCOMES = [
  "SUCCESS",
  "FAILURE",
  "PARTIAL",
  "DENIED",
  "BLOCKED",
  "CANCELLED",
  "TIMEOUT",
  "RETRIED",
  "UNKNOWN",
] as const;

export type SystemLogOutcome = (typeof SYSTEM_LOG_OUTCOMES)[number];

export type SystemLogVisibility =
  | "PUBLIC_ADMIN"
  | "RESTRICTED"
  | "SECURITY_ONLY"
  | "SYSTEM_ONLY";

export function detectEnvironment(): string {
  const env = process.env.NODE_ENV ?? "development";
  if (env === "production") return "PRODUCTION";
  if (env === "test") return "TEST";
  if (env === "development") return "DEVELOPMENT";
  return "UNKNOWN";
}

export function newRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function newCorrelationId(): string {
  return `cor_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Infer taxonomy from legacy/unclassified AuditLog.action strings. */
export function classifyAction(action: string): {
  category: SystemLogCategory;
  severity: SystemLogSeverity;
  outcome: SystemLogOutcome;
  visibility: SystemLogVisibility;
  isSecurityCandidate: boolean;
} {
  const a = action.toUpperCase();

  if (
    a.includes("DENIED") ||
    a.includes("UNAUTHORIZED") ||
    a.includes("CROSS_ORG") ||
    a.includes("PERMISSION_ESCALATION") ||
    a.includes("RATE_LIMIT") ||
    a.includes("INVALID_CSRF") ||
    a.includes("SUSPICIOUS")
  ) {
    return {
      category: "SECURITY",
      severity: "WARNING",
      outcome: "DENIED",
      visibility: "SECURITY_ONLY",
      isSecurityCandidate: true,
    };
  }

  if (
    a.includes("LOGIN") ||
    a.includes("LOGOUT") ||
    a.includes("SESSION") ||
    a.includes("PASSWORD_RESET") ||
    a.includes("MFA") ||
    a.includes("INVITATION")
  ) {
    const failed = a.includes("FAIL") || a.includes("DENIED");
    return {
      category: "AUTHENTICATION",
      severity: failed ? "WARNING" : "INFO",
      outcome: failed ? "FAILURE" : "SUCCESS",
      visibility: "RESTRICTED",
      isSecurityCandidate: failed,
    };
  }

  if (
    a.includes("ROLE") ||
    a.includes("PERMISSION") ||
    a.includes("ACCESS_DEACTIVATED") ||
    a.includes("ACCESS_REACTIVATED") ||
    a.includes("PRIVILEGE") ||
    a.includes("MASTER_ADMIN")
  ) {
    return {
      category: "AUTHORIZATION",
      severity: "WARNING",
      outcome: "SUCCESS",
      visibility: "RESTRICTED",
      isSecurityCandidate: true,
    };
  }

  if (a.startsWith("ADMIN_RECORD_") || a.startsWith("ADMIN_CONTENT_")) {
    return {
      category: "DATA_CHANGE",
      severity: a.includes("DELETE") || a.includes("BLOCKED") ? "WARNING" : "INFO",
      outcome: a.includes("BLOCKED") || a.includes("FAIL") ? "BLOCKED" : "SUCCESS",
      visibility: "PUBLIC_ADMIN",
      isSecurityCandidate: a.includes("PERMANENTLY_DELETED"),
    };
  }

  if (a.startsWith("APPROVAL_") || a.includes("APPROVAL")) {
    return {
      category: "APPROVAL",
      severity: "INFO",
      outcome: a.includes("REJECT") || a.includes("FAIL") ? "FAILURE" : "SUCCESS",
      visibility: "PUBLIC_ADMIN",
      isSecurityCandidate: false,
    };
  }

  if (a.startsWith("DATA_QUALITY_") || a.includes("DATA_QUALITY")) {
    return {
      category: "DATA_QUALITY",
      severity: a.includes("FAIL") ? "ERROR" : "INFO",
      outcome: a.includes("FAIL") ? "FAILURE" : "SUCCESS",
      visibility: "PUBLIC_ADMIN",
      isSecurityCandidate: false,
    };
  }

  if (a.includes("PORTAL") || a.includes("CUSTOMER_PORTAL")) {
    return {
      category: "CUSTOMER_PORTAL",
      severity: "INFO",
      outcome: "SUCCESS",
      visibility: "RESTRICTED",
      isSecurityCandidate: false,
    };
  }

  if (a.includes("EXPORT") || a.includes("_EXPORTED")) {
    return {
      category: "EXPORT",
      severity: a.includes("SENSITIVE") ? "WARNING" : "INFO",
      outcome: "SUCCESS",
      visibility: "RESTRICTED",
      isSecurityCandidate: a.includes("SENSITIVE"),
    };
  }

  if (a.includes("IMPORT")) {
    return {
      category: "IMPORT",
      severity: a.includes("FAIL") ? "ERROR" : "INFO",
      outcome: a.includes("FAIL") ? "FAILURE" : "SUCCESS",
      visibility: "PUBLIC_ADMIN",
      isSecurityCandidate: false,
    };
  }

  if (
    a.includes("CONFIG") ||
    a.includes("FEATURE_CONTROL") ||
    a.includes("SETTINGS_UPDATED") ||
    a.includes("RETENTION")
  ) {
    return {
      category: "CONFIGURATION",
      severity: "NOTICE",
      outcome: "SUCCESS",
      visibility: "RESTRICTED",
      isSecurityCandidate: false,
    };
  }

  if (
    a.includes("FAIL") ||
    a.includes("ERROR") ||
    a.includes("EXCEPTION") ||
    a.includes("CRASH")
  ) {
    return {
      category: "ERROR",
      severity: "ERROR",
      outcome: "FAILURE",
      visibility: "RESTRICTED",
      isSecurityCandidate: false,
    };
  }

  if (a.includes("API_") || a.startsWith("HTTP_")) {
    return {
      category: "API",
      severity: "INFO",
      outcome: "SUCCESS",
      visibility: "PUBLIC_ADMIN",
      isSecurityCandidate: false,
    };
  }

  if (a.includes("JOB_") || a.includes("BACKGROUND")) {
    return {
      category: "BACKGROUND_JOB",
      severity: a.includes("FAIL") ? "ERROR" : "INFO",
      outcome: a.includes("FAIL") ? "FAILURE" : "SUCCESS",
      visibility: "PUBLIC_ADMIN",
      isSecurityCandidate: false,
    };
  }

  if (a.includes("NOTIFICATION") || a.includes("EMAIL_")) {
    return {
      category: "NOTIFICATION",
      severity: a.includes("FAIL") ? "WARNING" : "INFO",
      outcome: a.includes("FAIL") ? "FAILURE" : "SUCCESS",
      visibility: "PUBLIC_ADMIN",
      isSecurityCandidate: false,
    };
  }

  if (
    a.includes("CREATED") ||
    a.includes("UPDATED") ||
    a.includes("DELETED") ||
    a.includes("ARCHIVED") ||
    a.includes("RESTORED") ||
    a.includes("MERGE")
  ) {
    return {
      category: "DATA_CHANGE",
      severity: "INFO",
      outcome: "SUCCESS",
      visibility: "PUBLIC_ADMIN",
      isSecurityCandidate: false,
    };
  }

  return {
    category: "AUDIT",
    severity: "INFO",
    outcome: "SUCCESS",
    visibility: "PUBLIC_ADMIN",
    isSecurityCandidate: false,
  };
}
