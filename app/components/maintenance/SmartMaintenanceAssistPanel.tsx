"use client";

import { useMemo, useState } from "react";
import {
  MatrixButton,
  MatrixCard,
  MatrixEmptyState,
  MatrixStatusBadge,
} from "@/app/components/ui";
import { recordMaintenanceAudit } from "@/lib/maintenance";
import {
  listDashboardAlertWidgets,
  listGroupedVisitRecommendations,
  listTechnicianTasks,
  updateTechnicianTask,
  type TechnicianTask,
} from "@/lib/notifications";

export default function SmartMaintenanceAssistPanel() {
  const [tick, setTick] = useState(0);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  const alerts = useMemo(() => {
    void tick;
    return listDashboardAlertWidgets();
  }, [tick]);

  const tasks = useMemo(() => {
    void tick;
    return listTechnicianTasks();
  }, [tick]);

  const visits = useMemo(() => {
    void tick;
    return listGroupedVisitRecommendations();
  }, [tick]);

  function patchTask(
    id: string,
    patch: Partial<Pick<TechnicianTask, "status" | "notes" | "scheduledDate">>,
  ) {
    updateTechnicianTask(id, patch);
    setTick((t) => t + 1);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {alerts.map((widget) => (
          <MatrixCard
            key={widget.id}
            title={widget.title}
            subtitle={widget.description}
          >
            <p className={`text-4xl font-bold ${widget.accent}`}>
              {widget.count}
            </p>
            <ul className="mt-3 max-h-28 space-y-1 overflow-y-auto text-xs text-slate-400">
              {widget.items.length === 0 ? (
                <li>None</li>
              ) : (
                widget.items.slice(0, 5).map((item) => (
                  <li key={item.id}>
                    {item.label}
                    <span className="block text-slate-600">{item.detail}</span>
                  </li>
                ))
              )}
            </ul>
          </MatrixCard>
        ))}
      </div>

      <MatrixCard
        title="Technician Task List"
        subtitle="Start, complete, reschedule, or add notes"
      >
        {tasks.length === 0 ? (
          <MatrixEmptyState
            title="No open tasks"
            description="Tasks appear when printers need PM, cleaning, or setup."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="px-2 py-2">Printer</th>
                  <th className="px-2 py-2">Customer</th>
                  <th className="px-2 py-2">Address</th>
                  <th className="px-2 py-2">Task</th>
                  <th className="px-2 py-2">Priority</th>
                  <th className="px-2 py-2">Duration</th>
                  <th className="px-2 py-2">Due</th>
                  <th className="px-2 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tasks.slice(0, 20).map((task) => (
                  <tr key={task.id} className="border-b border-slate-800/70">
                    <td className="px-2 py-2 font-medium">{task.printerName}</td>
                    <td className="px-2 py-2">{task.customerName}</td>
                    <td className="px-2 py-2 text-xs text-slate-400">
                      {task.address}
                    </td>
                    <td className="px-2 py-2">{task.taskType}</td>
                    <td className="px-2 py-2">
                      <MatrixStatusBadge
                        variant={
                          task.priority === "URGENT" || task.priority === "HIGH"
                            ? "error"
                            : "warning"
                        }
                        label={task.priority}
                      />
                    </td>
                    <td className="px-2 py-2">
                      {task.estimatedDurationHours}h
                    </td>
                    <td className="px-2 py-2">{task.dueStatus}</td>
                    <td className="px-2 py-2">
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          className="rounded border border-slate-700 px-2 py-1 text-xs"
                          onClick={() =>
                            patchTask(task.id, { status: "IN_PROGRESS" })
                          }
                        >
                          Start
                        </button>
                        <button
                          type="button"
                          className="rounded border border-slate-700 px-2 py-1 text-xs"
                          onClick={() =>
                            patchTask(task.id, { status: "COMPLETED" })
                          }
                        >
                          Complete
                        </button>
                        <button
                          type="button"
                          className="rounded border border-slate-700 px-2 py-1 text-xs"
                          onClick={() => {
                            const date = new Date();
                            date.setDate(date.getDate() + 3);
                            patchTask(task.id, {
                              status: "RESCHEDULED",
                              scheduledDate: date.toISOString().slice(0, 10),
                            });
                          }}
                        >
                          Reschedule
                        </button>
                      </div>
                      <input
                        className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                        placeholder="Add notes"
                        value={noteDrafts[task.id] ?? task.notes}
                        onChange={(e) =>
                          setNoteDrafts((d) => ({
                            ...d,
                            [task.id]: e.target.value,
                          }))
                        }
                        onBlur={() => {
                          const notes = noteDrafts[task.id];
                          if (notes !== undefined) {
                            patchTask(task.id, { notes });
                          }
                        }}
                      />
                      <p className="mt-1 text-[10px] text-slate-500">
                        Status: {task.status}
                        {task.scheduledDate ? ` · ${task.scheduledDate}` : ""}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </MatrixCard>

      <MatrixCard
        title="Customer Visit Optimization"
        subtitle="Combine multiple PMs at the same site into one visit"
      >
        {visits.length === 0 ? (
          <MatrixEmptyState
            title="No grouped visits suggested"
            description="Suggestions appear when multiple open tasks share a customer site."
          />
        ) : (
          <ul className="space-y-3">
            {visits.map((visit) => (
              <li
                key={visit.id}
                className="rounded-lg border border-slate-800 bg-slate-950/40 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-white">
                      {visit.customerName} · {visit.siteName}
                    </p>
                    <p className="text-sm text-slate-400">{visit.address}</p>
                    <p className="mt-2 text-sm text-cyan-300">
                      {visit.savingsNote}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Printers: {visit.printerNames.join(", ")} · Tasks:{" "}
                      {visit.taskTypes.join(", ")} · ~
                      {visit.estimatedDurationHours}h
                    </p>
                  </div>
                  <MatrixButton
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      recordMaintenanceAudit({
                        action: "SCHEDULE_RECOMMENDATION",
                        actor: "Matrix User",
                        details: `Accepted grouped visit recommendation for ${visit.siteName}`,
                        newValue: visit.id,
                      });
                      setTick((t) => t + 1);
                    }}
                  >
                    Accept plan
                  </MatrixButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </MatrixCard>
    </div>
  );
}
