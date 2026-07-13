"use client";

import { useState } from "react";
import MatrixShell from "../../components/MatrixShell";
import MatrixAuthGuard from "../../components/MatrixAuthGuard";
import {
  MatrixButton,
  MatrixCard,
  MatrixPageHeader,
} from "../../components/ui";
import MaintenanceSubnav from "../components/MaintenanceSubnav";
import {
  getPmSettings,
  listCleaningRules,
  listIntervalRules,
  listPmPartsKits,
  updatePmSettings,
} from "@/lib/pm-intelligence";

export default function PmSettingsPage() {
  const [settings, setSettings] = useState(() => getPmSettings());
  const intervals = listIntervalRules();
  const cleanings = listCleaningRules();
  const kits = listPmPartsKits();
  const [notice, setNotice] = useState("");

  function save() {
    const next = updatePmSettings(
      {
        countFreshnessDays: settings.countFreshnessDays,
        unusualIncreaseMultiplier: settings.unusualIncreaseMultiplier,
        defaultWarningThreshold: settings.defaultWarningThreshold,
        defaultCriticalThreshold: settings.defaultCriticalThreshold,
        defaultGraceThreshold: settings.defaultGraceThreshold,
      },
      "Service Manager",
    );
    setSettings(next);
    setNotice("Settings saved and audit-logged.");
  }

  return (
    <MatrixShell title="PM Settings" activePath="/maintenance">
      <MatrixAuthGuard requiredPermissions={["VIEW_FLEET_MAINTENANCE"]}>
        <MatrixPageHeader
          title="PM Settings"
          subtitle="Intervals, thresholds, forecasting rules, and health-score weights."
          breadcrumbs={["Matrix", "Preventive Maintenance", "Settings"]}
        />
        <MaintenanceSubnav />
        {notice ? (
          <p className="mb-4 rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
            {notice}
          </p>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <MatrixCard>
            <h2 className="mb-3 font-semibold text-slate-100">Thresholds</h2>
            <div className="grid gap-3 text-sm">
              {(
                [
                  ["countFreshnessDays", "Count freshness (days)"],
                  ["unusualIncreaseMultiplier", "Unusual increase multiplier"],
                  ["defaultWarningThreshold", "Warning threshold"],
                  ["defaultCriticalThreshold", "Critical threshold"],
                  ["defaultGraceThreshold", "Grace threshold"],
                ] as const
              ).map(([key, label]) => (
                <label key={key}>
                  <span className="text-slate-500">{label}</span>
                  <input
                    type="number"
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-2"
                    value={settings[key]}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        [key]: Number(e.target.value),
                      })
                    }
                  />
                </label>
              ))}
              <MatrixButton type="button" onClick={save}>
                Save settings
              </MatrixButton>
            </div>
          </MatrixCard>

          <MatrixCard>
            <h2 className="mb-3 font-semibold text-slate-100">
              Active PM interval rules
            </h2>
            <ul className="space-y-3 text-sm">
              {intervals.map((r) => (
                <li key={r.id} className="border-b border-slate-800 pb-2">
                  <p className="text-slate-100">{r.name}</p>
                  <p className="text-slate-500">
                    Every {r.intervalCount.toLocaleString()} · warn{" "}
                    {r.warningThreshold.toLocaleString()} · kit{" "}
                    {r.requiredPartsKitId}
                  </p>
                </li>
              ))}
            </ul>
          </MatrixCard>

          <MatrixCard>
            <h2 className="mb-3 font-semibold text-slate-100">Cleaning rules</h2>
            <ul className="space-y-2 text-sm text-slate-300">
              {cleanings.map((c) => (
                <li key={c.id}>
                  {c.label} · impressions {c.impressionInterval?.toLocaleString() ?? "—"}
                </li>
              ))}
            </ul>
          </MatrixCard>

          <MatrixCard>
            <h2 className="mb-3 font-semibold text-slate-100">PM kits</h2>
            <ul className="space-y-2 text-sm text-slate-300">
              {kits.map((k) => (
                <li key={k.id}>
                  {k.name} · {k.requiredParts.length} required parts
                </li>
              ))}
            </ul>
          </MatrixCard>
        </div>
      </MatrixAuthGuard>
    </MatrixShell>
  );
}
