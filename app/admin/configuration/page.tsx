"use client";

import { useEffect, useState } from "react";
import AdminShell from "../../components/admin/AdminShell";
import { MatrixButton, MatrixCard } from "../../components/ui";

type Entry = {
  id: string;
  configurationType: string;
  key: string;
  label: string;
  description: string | null;
  active: boolean;
  displayOrder: number;
  protected: boolean;
};

type RegistryItem = {
  key: string;
  label: string;
  description?: string;
  configurationType: string;
};

export default function AdminConfigurationPage() {
  const [registry, setRegistry] = useState<RegistryItem[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [regions, setRegions] = useState<
    Array<{ id: string; key: string; label: string; active: boolean }>
  >([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    const res = await fetch("/api/admin/configuration", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setError(data.error ?? "Unable to load configuration.");
      return;
    }
    setRegistry(data.registry);
    setEntries(data.entries);
    setRegions(data.regions);
  }

  useEffect(() => {
    void load();
  }, []);

  async function toggleActive(entry: Entry) {
    setNotice("");
    setError("");
    if (entry.protected && entry.active) {
      setError("System required values cannot be deactivated.");
      return;
    }
    const res = await fetch("/api/admin/configuration", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: entry.id,
        active: !entry.active,
        reason: "Admin configuration toggle",
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setError(data.error ?? "The configuration change could not be saved.");
      return;
    }
    setNotice("Configuration updated.");
    await load();
  }

  return (
    <AdminShell
      title="System Configuration"
      subtitle="Approved editable Matrix configuration. Prefer deactivate over delete for values used by historical records."
    >
      {error ? (
        <p className="mb-3 text-sm text-rose-300" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="mb-3 text-sm text-emerald-300" role="status">
          {notice}
        </p>
      ) : null}

      <div className="space-y-6">
        {registry.map((def) => {
          const group = entries.filter(
            (e) => e.configurationType === def.configurationType,
          );
          return (
            <MatrixCard
              key={def.key}
              title={def.label}
              subtitle={def.description}
            >
              {group.length === 0 ? (
                <p className="text-sm text-slate-500">No values configured.</p>
              ) : (
                <ul className="space-y-2">
                  {group.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex flex-col gap-2 rounded-lg border border-slate-800 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="text-sm text-slate-100">
                          {entry.label}{" "}
                          <span className="font-mono text-xs text-slate-500">
                            ({entry.key})
                          </span>
                          {entry.protected ? (
                            <span className="ml-2 text-xs text-cyan-300">
                              System Required
                            </span>
                          ) : null}
                        </p>
                        <p className="text-xs text-slate-500">
                          {entry.active ? "Active" : "Inactive"} · order{" "}
                          {entry.displayOrder}
                        </p>
                      </div>
                      <MatrixButton
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={entry.protected && entry.active}
                        onClick={() => void toggleActive(entry)}
                      >
                        {entry.active ? "Deactivate" : "Activate"}
                      </MatrixButton>
                    </li>
                  ))}
                </ul>
              )}
            </MatrixCard>
          );
        })}

        <MatrixCard title="Regions & Territories">
          <ul className="space-y-2">
            {regions.map((r) => (
              <li
                key={r.id}
                className="rounded-lg border border-slate-800 px-3 py-2 text-sm"
              >
                {r.label}{" "}
                <span className="font-mono text-xs text-slate-500">
                  ({r.key})
                </span>{" "}
                · {r.active ? "Active" : "Inactive"}
              </li>
            ))}
          </ul>
        </MatrixCard>
      </div>
    </AdminShell>
  );
}
