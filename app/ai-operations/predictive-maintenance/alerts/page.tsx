"use client";

import { useCallback, useEffect, useState } from "react";
import MatrixShell from "../../../components/MatrixShell";
import MatrixAuthGuard from "../../../components/MatrixAuthGuard";
import { MatrixButton, MatrixCard } from "../../../components/ui";
import PredictiveNav from "../PredictiveNav";

type Alert = {
  id: string;
  machineId: string;
  title: string;
  message: string;
  severity: string;
  status: string;
  alertType: string;
};

export default function PredictiveAlertsPage() {
  const [items, setItems] = useState<Alert[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(
      "/api/ai-operations/predictive-maintenance/alerts?status=OPEN",
      { cache: "no-store" },
    );
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setError(json.error ?? "Failed");
      return;
    }
    setItems(json.items);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(id: string, action: string) {
    await fetch("/api/ai-operations/predictive-maintenance/alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    await load();
  }

  return (
    <MatrixShell title="Predictive Alerts" activePath="/ai-operations/predictive-maintenance">
      <MatrixAuthGuard requiredPermissions={["VIEW_PREDICTIVE_MAINTENANCE"]}>
        <PredictiveNav />
        <MatrixCard title="Open predictive risk alerts" subtitle="Deduped · internal only">
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          {items.length === 0 ? (
            <p className="text-sm text-slate-500">No open alerts.</p>
          ) : (
            <ul className="space-y-3">
              {items.map((a) => (
                <li key={a.id} className="rounded-lg border border-slate-800 px-3 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-white">{a.title}</p>
                      <p className="text-xs text-slate-400">{a.message}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {a.machineId} · {a.severity} · {a.alertType}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <MatrixButton type="button" size="sm" variant="secondary" onClick={() => void act(a.id, "acknowledge")}>
                        Acknowledge
                      </MatrixButton>
                      <MatrixButton type="button" size="sm" variant="secondary" onClick={() => void act(a.id, "resolve")}>
                        Resolve
                      </MatrixButton>
                      <MatrixButton type="button" size="sm" variant="secondary" onClick={() => void act(a.id, "dismiss")}>
                        Dismiss
                      </MatrixButton>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </MatrixCard>
      </MatrixAuthGuard>
    </MatrixShell>
  );
}
