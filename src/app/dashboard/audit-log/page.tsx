"use client";

import { useState, useEffect } from "react";

interface AuditEntry {
  id: string;
  user: { id: string; name: string; email: string; role: string };
  impersonated_by: { id: string; name: string; email: string } | null;
  action: string;
  entity_table: string;
  entity_id: string;
  before: unknown;
  after: unknown;
  ip: string | null;
  created_at: string;
}

export default function OrgAuditLogPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const [fetchKey, setFetchKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    params.set("limit", "100");
    if (actionFilter) params.set("action", actionFilter);
    if (entityFilter) params.set("entity_table", entityFilter);
    if (startDate) params.set("start_date", startDate);
    if (endDate) params.set("end_date", endDate);

    fetch(`/api/v1/audit-logs?${params}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setLogs(d.data || []); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fetchKey, actionFilter, entityFilter, startDate, endDate]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
        <p className="text-sm text-gray-500 mt-1">
          View all actions performed in your organization.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Filter by action..."
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          type="text"
          placeholder="Filter by entity..."
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          onClick={() => setFetchKey((k) => k + 1)}
          className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
        >
          Search
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : logs.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
          <p className="text-gray-500">No audit log entries found.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-gray-500">
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">IP</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr
                  key={log.id}
                  className="border-b hover:bg-gray-50 cursor-pointer"
                  onClick={() =>
                    setExpanded(expanded === log.id ? null : log.id)
                  }
                >
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">
                      {log.user.name}
                    </div>
                    <div className="text-xs text-gray-500">{log.user.role}</div>
                    {log.impersonated_by && (
                      <div className="text-xs text-yellow-600">
                        ⚠ Impersonated by {log.impersonated_by.name}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {log.entity_table}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {log.ip || "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {expanded === log.id ? "▼" : "▶"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {expanded && (
            <div className="border-t bg-gray-50 p-4 text-xs">
              {(() => {
                const log = logs.find((l) => l.id === expanded);
                if (!log) return null;
                return (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h5 className="font-medium text-gray-600 mb-1">
                        Before
                      </h5>
                      <pre className="text-gray-700 whitespace-pre-wrap bg-white rounded p-2 border">
                        {log.before
                          ? JSON.stringify(log.before, null, 2)
                          : "—"}
                      </pre>
                    </div>
                    <div>
                      <h5 className="font-medium text-gray-600 mb-1">
                        After
                      </h5>
                      <pre className="text-gray-700 whitespace-pre-wrap bg-white rounded p-2 border">
                        {log.after
                          ? JSON.stringify(log.after, null, 2)
                          : "—"}
                      </pre>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
