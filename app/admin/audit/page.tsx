"use client";

import { useEffect, useState } from "react";
import AdminShell from "../../components/admin/AdminShell";
import { MatrixButton } from "../../components/ui";

type Event = {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  actorId: string | null;
  createdAt: string;
  payload: string | null;
};

export default function AdminAuditPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [q, setQ] = useState("");
  const [action, setAction] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError("");
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (action) sp.set("action", action);
    const res = await fetch(`/api/admin/audit?${sp.toString()}`, {
      cache: "no-store",
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setError(data.error ?? "Unable to load audit history.");
      setEvents([]);
      setLoading(false);
      return;
    }
    setEvents(data.events);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AdminShell
      title="Audit History"
      subtitle="Centralized administrative audit events. Sensitive values are redacted."
    >
      <form
        className="mb-4 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
      >
        <input
          className="min-h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm"
          placeholder="Search action or record"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="min-h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm"
          value={action}
          onChange={(e) => setAction(e.target.value)}
        >
          <option value="">All actions</option>
          {[
            "ADMIN_CENTER_VIEWED",
            "USER_ROLE_CHANGED",
            "USER_ACCESS_DEACTIVATED",
            "USER_ACCESS_REACTIVATED",
            "ORGANIZATION_SETTINGS_UPDATED",
            "SYSTEM_CONFIGURATION_UPDATED",
            "FEATURE_CONTROL_UPDATED",
          ].map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <MatrixButton type="submit" variant="primary" size="md">
          Filter
        </MatrixButton>
      </form>

      {loading ? (
        <p className="text-sm text-slate-400">Loading audit history…</p>
      ) : error ? (
        <p className="text-sm text-rose-300" role="alert">
          {error}
        </p>
      ) : events.length === 0 ? (
        <p className="text-sm text-slate-500">
          No audit records match the selected filters.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-950 text-slate-400">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Module</th>
                <th className="px-3 py-2">Record</th>
                <th className="px-3 py-2">Actor</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-t border-slate-800 align-top">
                  <td className="px-3 py-2 text-slate-400">
                    {e.createdAt.slice(0, 19).replace("T", " ")}
                  </td>
                  <td className="px-3 py-2 text-slate-100">{e.action}</td>
                  <td className="px-3 py-2 text-slate-400">
                    {e.entityType ?? "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-400">
                    {e.entityId ?? "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-500">
                    {e.actorId ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
