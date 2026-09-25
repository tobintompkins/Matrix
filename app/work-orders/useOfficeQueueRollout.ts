"use client";

import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import { hasMatrixPermission } from "@/lib/auth/permissions";
import { DEV_FALLBACK_ROLE } from "@/lib/auth/types";
import { listWorkOrders } from "@/lib/work-orders";
import type { OfficeRolloutGuardResult } from "@/lib/work-orders/office-rollout-guard";
import {
  resolveOfficeQueueRollout,
  useServerOfficeQueueSource,
  type OfficeQueueRolloutGuardCheck,
  type OfficeQueueRolloutResolution,
} from "@/lib/work-orders/office-queue-rollout";

type GuardFetchState = "idle" | "loading" | "ready" | "error";

export function useOfficeQueueRollout(officeFlagEnabled: boolean, queueTick = 0) {
  const isManager = hasMatrixPermission(DEV_FALLBACK_ROLE, "MANAGE_WORK_ORDERS");
  const [guardFetchState, setGuardFetchState] = useState<GuardFetchState>("idle");
  const [guard, setGuard] = useState<OfficeRolloutGuardResult | null>(null);
  const [guardError, setGuardError] = useState("");

  const refreshGuard = useCallback(async () => {
    if (!officeFlagEnabled || !isManager) {
      setGuard(null);
      setGuardFetchState("idle");
      setGuardError("");
      return;
    }
    setGuardFetchState("loading");
    setGuardError("");
    try {
      const browserWorkOrders = listWorkOrders();
      const response = await fetch("/api/work-orders/server-rollout-guard", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ browserWorkOrders }),
      });
      const body = (await response.json()) as {
        guard?: OfficeRolloutGuardResult;
        error?: string;
      };
      if (!response.ok || !body.guard) {
        throw new Error(body.error ?? "Could not evaluate office rollout guard.");
      }
      setGuard(body.guard);
      setGuardFetchState("ready");
    } catch (error) {
      setGuard(null);
      setGuardFetchState("error");
      setGuardError(
        error instanceof Error ? error.message : "Could not evaluate office rollout guard.",
      );
    }
  }, [officeFlagEnabled, isManager]);

  useEffect(() => {
    if (!officeFlagEnabled || !isManager) return;
    startTransition(() => {
      void refreshGuard();
    });
  }, [officeFlagEnabled, isManager, queueTick, refreshGuard]);

  const guardCheck: OfficeQueueRolloutGuardCheck = useMemo(() => {
    if (!officeFlagEnabled || !isManager) return { state: "not-required" };
    if (guardFetchState === "loading" || guardFetchState === "idle") {
      return { state: "pending" };
    }
    if (guardFetchState === "error" || !guard) {
      return {
        state: "ready",
        guardReady: false,
        blockedReasons: [
          guardError || "Rollout guard check failed. Using the browser queue until the guard passes.",
        ],
      };
    }
    return {
      state: "ready",
      guardReady: guard.readyToEnableOfficeFlag,
      blockedReasons: guard.readyToEnableOfficeFlag ? [] : guard.reasons,
    };
  }, [officeFlagEnabled, isManager, guardFetchState, guard, guardError]);

  const rollout: OfficeQueueRolloutResolution = useMemo(
    () =>
      resolveOfficeQueueRollout({
        officeFlagEnabled,
        isManager,
        guardCheck,
      }),
    [officeFlagEnabled, isManager, guardCheck],
  );

  const useServerQueue = useServerOfficeQueueSource(rollout);

  return {
    rollout,
    useServerQueue,
    isManager,
    guardFetchState,
    guardError,
    refreshGuard,
  };
}
