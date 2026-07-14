/**
 * Patch 49C — In-app admin job run registry (no external queue).
 * Records admin tool / import / export runs for visibility and safe retry of idempotent tools.
 */

export type AdminJobStatus =
  | "Queued"
  | "Running"
  | "Completed"
  | "Failed"
  | "Cancelled"
  | "Retrying"
  | "Scheduled";

export type AdminJobRun = {
  id: string;
  name: string;
  type: string;
  status: AdminJobStatus;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  attempts: number;
  triggeredBy: string;
  lastError: string | null;
  resultSummary: string | null;
  idempotent: boolean;
};

const STORAGE_KEY = "matrix.admin.jobs.v1";
let memory: AdminJobRun[] | null = null;

function read(): AdminJobRun[] {
  if (memory) return memory;
  if (typeof window !== "undefined") {
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        memory = JSON.parse(raw) as AdminJobRun[];
        return memory;
      }
    } catch {
      /* ignore */
    }
  }
  memory = [];
  return memory;
}

function write(next: AdminJobRun[]) {
  memory = next;
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function listAdminJobRuns(): AdminJobRun[] {
  return [...read()].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function recordAdminJobRun(
  input: {
    name: string;
    type: string;
    triggeredBy: string;
    idempotent: boolean;
    status?: AdminJobStatus;
    resultSummary?: string;
    lastError?: string;
  },
): AdminJobRun {
  const startedAt = new Date().toISOString();
  const row: AdminJobRun = {
    id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: input.name,
    type: input.type,
    status: input.status ?? "Completed",
    startedAt,
    completedAt: new Date().toISOString(),
    durationMs: 0,
    attempts: 1,
    triggeredBy: input.triggeredBy,
    lastError: input.lastError ?? null,
    resultSummary: input.resultSummary ?? null,
    idempotent: input.idempotent,
  };
  write([row, ...read()].slice(0, 100));
  return row;
}

export function retryAdminJob(
  jobId: string,
  actorName: string,
): { ok: true; job: AdminJobRun } | { ok: false; error: string } {
  const job = read().find((j) => j.id === jobId);
  if (!job) return { ok: false, error: "Job not found." };
  if (job.status !== "Failed") {
    return { ok: false, error: "Only failed jobs can be retried." };
  }
  if (!job.idempotent) {
    return {
      ok: false,
      error:
        "The background job could not be retried safely because duplicate processing could damage data.",
    };
  }
  const retry = recordAdminJobRun({
    name: `${job.name} (retry)`,
    type: job.type,
    triggeredBy: actorName,
    idempotent: true,
    status: "Completed",
    resultSummary: `Retry of ${job.id} recorded. Re-run the related admin tool to execute work.`,
  });
  return { ok: true, job: retry };
}

export function __resetAdminJobsForTests() {
  memory = [];
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
}
