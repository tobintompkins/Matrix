"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  MatrixButton,
  MatrixCard,
  MatrixSection,
} from "../components/ui";
import {
  getServiceCall,
  replaceServiceCall,
  type ServiceCall,
  type ServiceCallPriority,
  type ServiceCallType,
} from "@/lib/service-calls";

const fieldClass =
  "mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none";

type Props = { serviceCallId: string };

export default function ServiceCallEditForm({ serviceCallId }: Props) {
  const router = useRouter();
  const [call, setCall] = useState<ServiceCall | null>(
    () => getServiceCall(serviceCallId) ?? null,
  );
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  if (!call) {
    return (
      <MatrixCard title="Not found">
        <p className="text-sm text-slate-400">
          Service call {serviceCallId} was not found in this session.
        </p>
        <div className="mt-4">
          <MatrixButton href="/service-calls" variant="secondary" size="md">
            Back
          </MatrixButton>
        </div>
      </MatrixCard>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      {notice && (
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 px-4 py-3 text-sm text-cyan-200">
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      <MatrixSection title="Edit service call">
        <MatrixCard title={call.workOrderNumber}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm text-slate-300">
              Issue title
              <input
                className={fieldClass}
                value={call.problem.issueTitle}
                onChange={(e) =>
                  setCall({
                    ...call,
                    problem: { ...call.problem, issueTitle: e.target.value },
                  })
                }
              />
            </label>
            <label className="text-sm text-slate-300">
              Priority
              <select
                className={fieldClass}
                value={call.priority}
                onChange={(e) =>
                  setCall({
                    ...call,
                    priority: e.target.value as ServiceCallPriority,
                  })
                }
              >
                {(["LOW", "NORMAL", "HIGH", "URGENT", "EMERGENCY"] as const).map(
                  (p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label className="text-sm text-slate-300">
              Service type
              <select
                className={fieldClass}
                value={call.serviceType}
                onChange={(e) =>
                  setCall({
                    ...call,
                    serviceType: e.target.value as ServiceCallType,
                  })
                }
              >
                {(
                  [
                    "BREAK_FIX",
                    "PREVENTIVE_MAINTENANCE",
                    "INSTALLATION",
                    "NETWORK_SUPPORT",
                    "OPERATOR_TRAINING",
                    "INSPECTION",
                    "REMOTE_SUPPORT",
                    "FOLLOW_UP",
                    "OTHER",
                  ] as const
                ).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-slate-300">
              Technician
              <input
                className={fieldClass}
                value={call.assignment.technician}
                onChange={(e) =>
                  setCall({
                    ...call,
                    assignment: {
                      ...call.assignment,
                      technician: e.target.value,
                    },
                  })
                }
              />
            </label>
            <label className="text-sm text-slate-300 sm:col-span-2">
              Problem description
              <textarea
                className={fieldClass + " min-h-[100px]"}
                value={call.problem.problemDescription}
                onChange={(e) =>
                  setCall({
                    ...call,
                    problem: {
                      ...call.problem,
                      problemDescription: e.target.value,
                    },
                  })
                }
              />
            </label>
            <label className="text-sm text-slate-300">
              Requested date
              <input
                type="date"
                className={fieldClass}
                value={call.schedule.requestedServiceDate}
                onChange={(e) =>
                  setCall({
                    ...call,
                    schedule: {
                      ...call.schedule,
                      requestedServiceDate: e.target.value,
                    },
                  })
                }
              />
            </label>
            <label className="text-sm text-slate-300">
              Scheduled start
              <input
                className={fieldClass}
                value={call.schedule.scheduledStart}
                onChange={(e) =>
                  setCall({
                    ...call,
                    schedule: {
                      ...call.schedule,
                      scheduledStart: e.target.value,
                    },
                  })
                }
              />
            </label>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <MatrixButton
              size="lg"
              variant="primary"
              onClick={() => {
                if (!call.problem.issueTitle.trim()) {
                  setError("Issue title is required.");
                  return;
                }
                const saved = replaceServiceCall(call);
                if (!saved) {
                  setError("Failed to save.");
                  return;
                }
                setNotice("Service call updated (local session).");
                router.push(`/service-calls/${call.id}`);
              }}
            >
              Save Changes
            </MatrixButton>
            <MatrixButton
              href={`/service-calls/${call.id}`}
              size="lg"
              variant="secondary"
            >
              Cancel
            </MatrixButton>
          </div>
        </MatrixCard>
      </MatrixSection>
    </div>
  );
}
