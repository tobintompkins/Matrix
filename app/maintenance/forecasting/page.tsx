"use client";

import { useMemo, useState } from "react";
import MatrixShell from "../../components/MatrixShell";
import MatrixAuthGuard from "../../components/MatrixAuthGuard";
import { MatrixCard, MatrixPageHeader, MatrixStatCard } from "../../components/ui";
import MaintenanceSubnav from "../components/MaintenanceSubnav";
import ForecastConfidenceBadge from "../components/ForecastConfidenceBadge";
import { getForecast, type ForecastWindow } from "@/lib/pm-intelligence";

export default function ForecastingPage() {
  const [window, setWindow] = useState<ForecastWindow>("30d");
  const forecast = useMemo(() => getForecast(window), [window]);

  return (
    <MatrixShell title="PM Forecasting" activePath="/maintenance">
      <MatrixAuthGuard requiredPermissions={["VIEW_FLEET_MAINTENANCE"]}>
        <MatrixPageHeader
          title="Forecasting"
          subtitle="Projected PM and cleaning workload from meter history and intervals."
          breadcrumbs={["Matrix", "Preventive Maintenance", "Forecasting"]}
        />
        <MaintenanceSubnav />

        <label className="mb-6 block text-sm">
          <span className="text-slate-500">Forecast window</span>
          <select
            className="mt-1 rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
            value={window}
            onChange={(e) => setWindow(e.target.value as ForecastWindow)}
          >
            <option value="7d">Next 7 Days</option>
            <option value="14d">Next 14 Days</option>
            <option value="30d">Next 30 Days</option>
            <option value="60d">Next 60 Days</option>
            <option value="90d">Next 90 Days</option>
            <option value="6m">Next 6 Months</option>
            <option value="12m">Next 12 Months</option>
          </select>
        </label>

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MatrixStatCard label="PMs expected" value={forecast.machinesReachingPm} />
          <MatrixStatCard label="DTF cleanings" value={forecast.expectedDtfCleanings} />
          <MatrixStatCard
            label="Joint cleanings"
            value={forecast.expectedJointCleanings}
          />
          <MatrixStatCard
            label="Est. labor hours"
            value={forecast.estimatedLaborHours}
          />
        </div>

        <div className="mb-8 grid gap-4 lg:grid-cols-3">
          <MatrixCard>
            <h3 className="text-sm font-semibold text-slate-200">By customer</h3>
            <ul className="mt-3 space-y-1 text-sm text-slate-300">
              {forecast.workloadByCustomer.map((c) => (
                <li key={c.customer} className="flex justify-between">
                  <span>{c.customer}</span>
                  <span>{c.jobs}</span>
                </li>
              ))}
            </ul>
          </MatrixCard>
          <MatrixCard>
            <h3 className="text-sm font-semibold text-slate-200">By model</h3>
            <ul className="mt-3 space-y-1 text-sm text-slate-300">
              {forecast.workloadByModel.map((c) => (
                <li key={c.model} className="flex justify-between">
                  <span>{c.model}</span>
                  <span>{c.jobs}</span>
                </li>
              ))}
            </ul>
          </MatrixCard>
          <MatrixCard>
            <h3 className="text-sm font-semibold text-slate-200">Parts kits demanded</h3>
            <ul className="mt-3 space-y-1 text-sm text-slate-300">
              {forecast.estimatedPartsDemand.length === 0 ? (
                <li className="text-slate-500">None identified</li>
              ) : (
                forecast.estimatedPartsDemand.map((k) => <li key={k}>{k}</li>)
              )}
            </ul>
          </MatrixCard>
        </div>

        <MatrixCard>
          <h3 className="mb-3 text-sm font-semibold text-slate-200">
            {forecast.windowLabel} detail
          </h3>
          <ul className="space-y-3">
            {forecast.items.length === 0 ? (
              <li className="text-slate-500">
                Not enough count history to produce a reliable forecast for this window.
              </li>
            ) : (
              forecast.items.map((item, i) => (
                <li
                  key={`${item.printerId}-${item.kind}-${i}`}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2 text-sm"
                >
                  <div>
                    <p className="text-slate-100">
                      {item.machineName} · {item.kind}
                    </p>
                    <p className="text-slate-500">
                      {item.customerName} · {item.reason}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400">
                      {item.estimatedDate ?? "Uncertain"}
                    </span>
                    <ForecastConfidenceBadge confidence={item.confidence} />
                  </div>
                </li>
              ))
            )}
          </ul>
        </MatrixCard>
      </MatrixAuthGuard>
    </MatrixShell>
  );
}
