import type { ConnectivityStatus } from "./types";

export type ConnectivityListener = (status: ConnectivityStatus) => void;

export type HealthCheckFn = () => Promise<boolean>;

const DEFAULT_HEALTH_PATH = "/api/field/health";

/**
 * Connectivity service — browser online ≠ Matrix reachable.
 */
export class ConnectivityService {
  private status: ConnectivityStatus = "ONLINE";
  private listeners = new Set<ConnectivityListener>();
  private healthCheck: HealthCheckFn;
  private unstableFailures = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(healthCheck?: HealthCheckFn) {
    this.healthCheck =
      healthCheck ??
      (async () => {
        if (typeof fetch === "undefined") return true;
        try {
          const res = await fetch(DEFAULT_HEALTH_PATH, {
            method: "GET",
            cache: "no-store",
          });
          return res.ok;
        } catch {
          return false;
        }
      });
  }

  getStatus(): ConnectivityStatus {
    return this.status;
  }

  subscribe(listener: ConnectivityListener): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  private setStatus(next: ConnectivityStatus) {
    if (next === this.status) return;
    this.status = next;
    for (const l of this.listeners) l(next);
  }

  /** Force status (sync engine / tests). */
  setManualStatus(status: ConnectivityStatus) {
    this.setStatus(status);
  }

  async refresh(): Promise<ConnectivityStatus> {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      this.unstableFailures = 0;
      this.setStatus("OFFLINE");
      return this.status;
    }

    const ok = await this.healthCheck();
    if (!ok) {
      this.unstableFailures += 1;
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        this.setStatus("OFFLINE");
      } else if (this.unstableFailures >= 2) {
        this.setStatus("OFFLINE");
      } else {
        this.setStatus("UNSTABLE");
      }
      return this.status;
    }

    this.unstableFailures = 0;
    if (this.status !== "SYNCHRONIZING") {
      this.setStatus("ONLINE");
    }
    return this.status;
  }

  markSynchronizing() {
    this.setStatus("SYNCHRONIZING");
  }

  markSyncFailed() {
    this.setStatus("SYNC_FAILED");
  }

  markOnline() {
    this.setStatus("ONLINE");
  }

  startPolling(intervalMs = 30_000) {
    if (this.timer) return;
    void this.refresh();
    this.timer = setInterval(() => {
      void this.refresh();
    }, intervalMs);

    if (typeof window !== "undefined") {
      window.addEventListener("online", () => void this.refresh());
      window.addEventListener("offline", () => this.setStatus("OFFLINE"));
    }
  }

  stopPolling() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

let shared: ConnectivityService | null = null;

export function getConnectivityService(): ConnectivityService {
  if (!shared) shared = new ConnectivityService();
  return shared;
}

export function resetConnectivityServiceForTests(): void {
  shared = null;
}

export function isOfflineLike(status: ConnectivityStatus): boolean {
  return status === "OFFLINE" || status === "UNSTABLE" || status === "SYNC_FAILED";
}
