"use client";

import { useState } from "react";
import { MatrixButton, MatrixCard } from "../../components/ui";
import PortalShell from "../PortalShell";
import { getNotificationPrefs, saveNotificationPrefs } from "@/lib/portal";

export default function PortalNotificationsPage() {
  const initial = getNotificationPrefs();
  const [prefs, setPrefs] = useState(initial);
  const [notice, setNotice] = useState("");

  if (!prefs) {
    return (
      <PortalShell title="Notifications">
        <p className="text-rose-300">Sign in with an active membership.</p>
      </PortalShell>
    );
  }

  return (
    <PortalShell title="Notification preferences">
      {notice ? <p className="mb-3 text-sm text-cyan-200">{notice}</p> : null}
      <MatrixCard title="Delivery">
        <div className="grid gap-3 text-sm">
          {(
            [
              ["ticketUpdates", "Ticket updates"],
              ["appointments", "Appointments"],
              ["pmUpdates", "PM updates"],
              ["reports", "Reports"],
              ["announcements", "Announcements"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center justify-between gap-3">
              <span className="text-slate-300">{label}</span>
              <select
                value={prefs[key]}
                onChange={(e) =>
                  setPrefs({
                    ...prefs,
                    [key]: e.target.value as typeof prefs.ticketUpdates,
                  })
                }
                className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-white"
              >
                <option value="IMMEDIATE">Immediate</option>
                <option value="DAILY">Daily summary</option>
                <option value="OFF">Off</option>
              </select>
            </label>
          ))}
          <label className="flex items-center gap-2 text-slate-300">
            <input
              type="checkbox"
              checked={prefs.inAppEnabled}
              onChange={(e) => setPrefs({ ...prefs, inAppEnabled: e.target.checked })}
            />
            In-app notifications
          </label>
          <label className="flex items-center gap-2 text-slate-400">
            <input type="checkbox" checked={prefs.emailEnabled} disabled readOnly />
            Email (architecture ready)
          </label>
          <label className="flex items-center gap-2 text-slate-400">
            <input type="checkbox" checked={prefs.smsEnabled} disabled readOnly />
            SMS (architecture ready)
          </label>
          <MatrixButton
            type="button"
            variant="primary"
            size="md"
            onClick={() => {
              const r = saveNotificationPrefs(prefs);
              setNotice(r.ok ? "Preferences saved" : r.error ?? "Failed");
            }}
          >
            Save preferences
          </MatrixButton>
        </div>
      </MatrixCard>
    </PortalShell>
  );
}
