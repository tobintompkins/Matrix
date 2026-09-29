"use client";

import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import { hasMatrixPermission } from "@/lib/auth/permissions";
import { DEV_FALLBACK_ROLE } from "@/lib/auth/types";
import { listWorkOrders } from "@/lib/work-orders";
import type { OfficeRolloutStatus } from "@/lib/work-orders/office-rollout-status";
import {
  useServerOfficeQueueSource,
  type OfficeQueueRolloutResolution,
} from "@/lib/work-orders/office-queue-rollout";

type RolloutFetchState = "idle" | "loading" | "ready" | "error";

export function useOfficeQueueRollout(officeFlagEnabled: boolean, queueTick = 0) {
  const isManager = hasMatrixPermission(DEV_FALLBACK_ROLE, "MANAGE_WORK_ORDERS");
  const canViewWorkOrders = hasMatrixPermission(DEV_FALLBACK_ROLE, "VIEW_WORK_ORDERS");
  const canLoadRollout = isManager || canViewWorkOrders;
  const [rolloutFetchState, setRolloutFetchState] = useState<RolloutFetchState>("idle");
  const [rolloutStatus, setRolloutStatus] = useState<OfficeRolloutStatus | null>(null);
  const [rolloutError, setRolloutError] = useState("");

  const refreshRolloutStatus = useCallback(async () => {
    if (!officeFlagEnabled || !canLoadRollout) {
      setRolloutStatus(null);
      setRolloutFetchState("idle");
      setRolloutError("");
      return;
    }
    setRolloutFetchState("loading");
    setRolloutError("");
    try {
      const browserWorkOrders = listWorkOrders();
      const response = await fetch("/api/work-orders/server-office-rollout/status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ browserWorkOrders }),
      });
      const body = (await response.json()) as {
        rolloutStatus?: OfficeRolloutStatus;
        error?: string;
      };
      if (!response.ok || !body.rolloutStatus) {
        throw new Error(body.error ?? "Could not load office rollout status.");
      }
      setRolloutStatus(body.rolloutStatus);
      setRolloutFetchState("ready");
    } catch (error) {
      setRolloutStatus(null);
      setRolloutFetchState("error");
      setRolloutError(
        error instanceof Error ? error.message : "Could not load office rollout status.",
      );
    }
  }, [officeFlagEnabled, canLoadRollout]);

  useEffect(() => {
    if (!officeFlagEnabled || !canLoadRollout) return;
    startTransition(() => {
      void refreshRolloutStatus();
    });
  }, [officeFlagEnabled, canLoadRollout, queueTick, refreshRolloutStatus]);

  const rollout: OfficeQueueRolloutResolution = useMemo(() => {
    if (!officeFlagEnabled) {
      return {
        source: "browser",
        indicator: "browser-default",
        title: "Browser work order queue",
        description: "MATRIX_SERVER_OFFICE_WORK_ORDERS is off.",
        blockedReasons: [],
      };
    }
    if (!canLoadRollout) {
      return {
        source: "browser",
        indicator: "browser-rollback",
        title: "Browser work order queue",
        description: "Office server rollout status requires work-order view permission.",
        blockedReasons: [],
      };
    }
    if (rolloutFetchState === "loading" || rolloutFetchState === "idle") {
      return {
        source: "browser",
        indicator: "browser-rollback",
        title: "Browser queue while rollout status is checked",
        description: "Loading pilot, dispatcher, and role expansion status.",
        blockedReasons: [],
      };
    }
    if (rolloutFetchState === "error" || !rolloutStatus) {
      return {
        source: "browser",
        indicator: "browser-rollback",
        title: "Browser queue (rollout status unavailable)",
        description:
          rolloutError || "Could not verify rollout status. Using the browser queue until checks pass.",
        blockedReasons: rolloutError ? [rolloutError] : [],
      };
    }
    return rolloutStatus.effectiveRollout;
  }, [officeFlagEnabled, canLoadRollout, rolloutFetchState, rolloutStatus, rolloutError]);

  const useServerQueue = useServerOfficeQueueSource(rollout);

  return {
    rollout,
    useServerQueue,
    isManager,
    rolloutFetchState,
    rolloutError,
    rolloutStatus,
    effectiveQueueReason: rolloutStatus?.effectiveQueueReason ?? "",
    refreshRolloutStatus,
  };
}
