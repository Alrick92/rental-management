"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface AuditEntry {
  id: string;
  user: { id: string; name: string; email: string; role: string };
  impersonated_by: { id: string; name: string; email: string } | null;
  organization: { id: string; name: string; slug: string } | null;
  action: string;
  entity_table: string;
  entity_id: string;
  before: unknown;
  after: unknown;
  ip: string | null;
  request_id: string | null;
  created_at: string;
}

export default function AdminAuditLogPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const [fetchKey, setFetchKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    params.set("limit", "100");
    if (actionFilter) params.set("action", actionFilter);
    if (entityFilter) params.set("entity_table", entityFilter);

    fetch(`/api/v1/admin/audit-logs?${params}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setLogs(d.data || []); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fetchKey, actionFilter, entityFilter]);

  return (
    <div className="min-h-screen bg-[#0f2440] text-white">
      <nav className="border-b border-[#234681] bg-[#1a365d]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold uppercase tracking-wide">
            <Link href="/admin" className="text-[#94a3b8] hover:text-white">
              Admin
            </Link>
            {" / "}Audit Log
          </h1>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex gap-4">
          <input
            type="text"
            placeholder="Filter by action..."
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="rounded border border-[#234681] bg-[#1a365d] px-3 py-2 text-sm text-white"
          />
          <input
            type="text"
            placeholder="Filter by entity table..."
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="rounded border border-[#234681] bg-[#1a365d] px-3 py-2 text-sm text-white"
          />
          <button
            onClick={() => setFetchKey((k) => k + 1)}
            className="rounded bg-[#d97706] px-4 py-2 text-sm hover:bg-[#b45309]"
          >
            Search
          </button>
        </div>

        {loading ? (
          <p className="text-[#94a3b8]">Loading...</p>
        ) : logs.length === 0 ? (
          <p className="text-[#94a3b8]">No audit log entries found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#234681] text-left text-[#94a3b8]">
                  <th className="pb-2 pr-4">Time</th>
                  <th className="pb-2 pr-4">User</th>
                  <th className="pb-2 pr-4">Org</th>
                  <th className="pb-2 pr-4">Action</th>
                  <th className="pb-2 pr-4">Entity</th>
                  <th className="pb-2 pr-4">IP</th>
                  <th className="pb-2">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-[#1a365d] hover:bg-[#1a365d]/50 cursor-pointer"
                    onClick={() =>
                      setExpanded(expanded === log.id ? null : log.id)
                    }
                  >
                    <td className="py-2 pr-4 text-slate-300">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="py-2 pr-4">
                      <div className="text-white">{log.user.name}</div>
                      <div className="text-xs text-[#64748b]">
                        {log.user.role}
                      </div>
                      {log.impersonated_by && (
                        <div className="text-xs text-yellow-400">
                          via {log.impersonated_by.name}
                        </div>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-slate-300">
                      {log.organization?.name || "—"}
                    </td>
                    <td className="py-2 pr-4">
                      <span className="rounded bg-[#234681] px-2 py-0.5 text-xs">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-slate-300">
                      {log.entity_table}
                    </td>
                    <td className="py-2 pr-4 text-[#94a3b8] text-xs">
                      {log.ip || "—"}
                    </td>
                    <td className="py-2 text-[#94a3b8] text-xs">
                      {expanded === log.id ? "▼" : "▶"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {expanded && (
              <div className="mt-2 rounded bg-[#1a365d] p-4 text-xs">
                <h4 className="mb-2 text-slate-300">
                  Change Details (ID: {expanded})
                </h4>
                {(() => {
                  const log = logs.find((l) => l.id === expanded);
                  if (!log) return null;
                  return (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h5 className="text-[#94a3b8] mb-1">Before</h5>
                        <pre className="text-slate-300 whitespace-pre-wrap">
                          {log.before
                            ? JSON.stringify(log.before, null, 2)
                            : "—"}
                        </pre>
                      </div>
                      <div>
                        <h5 className="text-[#94a3b8] mb-1">After</h5>
                        <pre className="text-slate-300 whitespace-pre-wrap">
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
      </main>
    </div>
  );
}
