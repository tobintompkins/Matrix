"use client";

import { useState } from "react";
import { MatrixButton, MatrixCard } from "../../components/ui";
import { hasMatrixPermission } from "@/lib/auth/permissions";
import { DEV_FALLBACK_ROLE } from "@/lib/auth/types";
import {
  getNotificationPreferences,
  getReminderThresholds,
  saveNotificationPreferences,
  updateReminderThresholds,
  type NotificationPreferences,
  type ReminderThresholdConfig,
} from "@/lib/notifications";

const USER_ID = "Matrix User";

export default function NotificationPreferencesPanel() {
  const canEditThresholds = hasMatrixPermission(
    DEV_FALLBACK_ROLE,
    "EDIT_REMINDER_THRESHOLDS",
  );
  const [prefs, setPrefs] = useState<NotificationPreferences>(() =>
    getNotificationPreferences(USER_ID),
  );
  const [thresholds, setThresholds] = useState<ReminderThresholdConfig>(() =>
    getReminderThresholds(),
  );
  const [message, setMessage] = useState("");

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <MatrixCard
        title="Delivery Preferences"
        subtitle="Email and SMS flags are stored now for future delivery without schema changes."
      >
        <div className="space-y-3 text-sm">
          {(
            [
              ["inAppEnabled", "In-app notifications"],
              ["dailySummaryEnabled", "Daily summary"],
              ["weeklySummaryEnabled", "Weekly summary"],
              ["emailEnabled", "Email (reserved — not sent yet)"],
              ["smsEnabled", "SMS (reserved — not sent yet)"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-3 text-slate-300">
              <input
                type="checkbox"
                checked={prefs[key]}
                onChange={(e) =>
                  setPrefs((p) => ({ ...p, [key]: e.target.checked }))
                }
              />
              {label}
            </label>
          ))}
          <MatrixButton
            variant="primary"
            size="md"
            onClick={() => {
              const saved = saveNotificationPreferences({
                ...prefs,
                userId: USER_ID,
              });
              setPrefs(saved);
              setMessage("Preferences saved.");
            }}
          >
            Save Preferences
          </MatrixButton>
        </div>
      </MatrixCard>

      <MatrixCard
        title="Reminder Thresholds"
        subtitle="Editable setup values used by the reminder engine"
      >
        {!canEditThresholds ? (
          <p className="text-sm text-amber-300">
            Only administrators and managers can edit reminder thresholds.
          </p>
        ) : (
          <div className="space-y-3 text-sm">
            <p className="text-xs text-slate-500">{thresholds.notes}</p>
            {(
              [
                ["pmDueSoonCopies", "Copies before PM (due soon)"],
                ["cleaningDueSoonCopies", "Copies before Cleaning"],
                ["dueTodayCopies", "Due today remaining copies"],
                ["overdueBand1Copies", "Overdue band 1 (copies)"],
                ["overdueBand2Copies", "Overdue band 2 (copies)"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block">
                <span className="text-slate-400">{label}</span>
                <input
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                  value={thresholds[key]}
                  onChange={(e) =>
                    setThresholds((t) => ({
                      ...t,
                      [key]: Number(e.target.value),
                    }))
                  }
                />
              </label>
            ))}
            <MatrixButton
              variant="primary"
              size="md"
              onClick={() => {
                const saved = updateReminderThresholds(thresholds, USER_ID);
                setThresholds(saved);
                setMessage("Reminder thresholds updated. Reminders will regenerate.");
              }}
            >
              Save Thresholds
            </MatrixButton>
          </div>
        )}
      </MatrixCard>

      {message && <p className="text-sm text-cyan-300 xl:col-span-2">{message}</p>}
    </div>
  );
}
