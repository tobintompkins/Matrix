"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ExecutiveAnalyticsPayload } from "@/lib/executive-command-center/analytics-types";

export function useExecutiveAnalytics() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const range = searchParams.get("range") || "LAST_30";
  const [analytics, setAnalytics] = useState<ExecutiveAnalyticsPayload | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/executive-command-center/analytics?range=${encodeURIComponent(range)}`,
        { cache: "no-store" },
      );
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? "Failed to load analytics.");
      }
      setAnalytics(json.analytics);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load analytics.");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  function setRange(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", next);
    router.push(`?${params.toString()}`);
  }

  return { range, setRange, analytics, loading, error, reload: load };
}
