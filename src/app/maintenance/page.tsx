"use client";

import { useEffect, useState } from "react";

interface Ticket {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  createdAt: string;
  unit: { id: string; name: string };
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-red-100 text-red-800 border-red-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  low: "bg-green-100 text-green-800 border-green-200",
};

const PRIORITY_DOT: Record<string, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-green-500",
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-100 text-blue-700",
  in_progress: "bg-purple-100 text-purple-700",
  resolved: "bg-green-100 text-green-700",
  cancelled: "bg-[#f1f5f9] text-[#475569]",
};

type FilterStatus = "all" | "open" | "in_progress" | "resolved";

export default function MaintenanceWorkOrdersPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/v1/maintenance-tickets");
      if (res.ok) {
        const data = await res.json();
        setTickets(data.data);
      }
      setLoading(false);
    }
    load();
  }, []);

  const handleResolve = async (ticketId: string) => {
    const res = await fetch(
      `/api/v1/maintenance-tickets/${ticketId}/resolve`,
      { method: "POST" }
    );
    if (res.ok) {
      setTickets((prev) =>
        prev.map((t) =>
          t.id === ticketId ? { ...t, status: "resolved" } : t
        )
      );
    }
  };

  const filteredTickets =
    filter === "all"
      ? tickets
      : tickets.filter((t) => t.status === filter);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] p-4">
        <div className="text-[#64748b]">Loading work orders...</div>
      </div>
    );
  }

  const openCount = tickets.filter((t) => t.status === "open").length;
  const inProgressCount = tickets.filter(
    (t) => t.status === "in_progress"
  ).length;

  return (
    <div className="pb-20 md:pb-8">
      {/* Header - compact on mobile */}
      <div className="mb-4 md:mb-6">
        <h2 className="text-lg md:text-xl font-semibold text-[#1e293b]">
          Work Orders
        </h2>
        <p className="mt-1 text-xs md:text-sm text-[#64748b]">
          {openCount} open · {inProgressCount} in progress
        </p>
      </div>

      {/* Status filter tabs - scrollable on mobile */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {(
          [
            { value: "all", label: "All", count: tickets.length },
            { value: "open", label: "Open", count: openCount },
            { value: "in_progress", label: "In Progress", count: inProgressCount },
            { value: "resolved", label: "Resolved", count: tickets.filter((t) => t.status === "resolved").length },
          ] as const
        ).map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={`flex-shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              filter === tab.value
                ? "bg-[#1a365d] text-white"
                : "bg-[#f1f5f9] text-[#475569] hover:bg-[#e2e8f0]"
            }`}
          >
            {tab.label}
            <span
              className={`ml-1.5 text-xs ${
                filter === tab.value ? "text-[#d97706]" : "text-[#94a3b8]"
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Desktop table view */}
      <div className="hidden md:block bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#f8fafc] border-b">
            <tr>
              <th className="text-left p-3">Title</th>
              <th className="text-left p-3">Unit</th>
              <th className="text-left p-3">Priority</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Date</th>
              <th className="text-left p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTickets.map((t) => (
              <tr key={t.id} className="border-b hover:bg-[#f8fafc]">
                <td className="p-3">
                  <div className="font-medium">{t.title}</div>
                  {t.description && (
                    <div className="text-xs text-[#64748b] mt-0.5 line-clamp-1">
                      {t.description}
                    </div>
                  )}
                </td>
                <td className="p-3">{t.unit.name}</td>
                <td className="p-3">
                  <span
                    className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                      PRIORITY_COLORS[t.priority] || "bg-[#f1f5f9]"
                    }`}
                  >
                    {t.priority}
                  </span>
                </td>
                <td className="p-3">
                  <span
                    className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                      STATUS_COLORS[t.status] || "bg-[#f1f5f9]"
                    }`}
                  >
                    {t.status.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="p-3 text-[#64748b]">
                  {new Date(t.createdAt).toLocaleDateString()}
                </td>
                <td className="p-3">
                  {t.status !== "resolved" && t.status !== "cancelled" && (
                    <button
                      onClick={() => handleResolve(t.id)}
                      className="rounded bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700"
                    >
                      Resolve
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filteredTickets.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-[#64748b]">
                  No work orders found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile card view */}
      <div className="md:hidden space-y-3">
        {filteredTickets.length === 0 ? (
          <div className="rounded-lg border border-[#e2e8f0] bg-white p-8 text-center text-[#64748b]">
            No work orders found.
          </div>
        ) : (
          filteredTickets.map((t) => (
            <div
              key={t.id}
              className={`rounded-lg border bg-white overflow-hidden transition-shadow ${
                expandedId === t.id ? "shadow-md border-[#1a365d]/20" : "border-[#e2e8f0]"
              }`}
            >
              <button
                onClick={() =>
                  setExpandedId(expandedId === t.id ? null : t.id)
                }
                className="w-full text-left p-4 active:bg-[#f8fafc]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                          PRIORITY_DOT[t.priority] || "bg-[#94a3b8]"
                        }`}
                      />
                      <h3 className="font-medium text-[#1e293b] truncate">
                        {t.title}
                      </h3>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-[#64748b]">
                      <span>{t.unit.name}</span>
                      <span>·</span>
                      <span>{new Date(t.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <span
                    className={`flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                      STATUS_COLORS[t.status] || "bg-[#f1f5f9] text-[#64748b]"
                    }`}
                  >
                    {t.status.replace(/_/g, " ")}
                  </span>
                </div>
              </button>

              {expandedId === t.id && (
                <div className="border-t border-[#f1f5f9] px-4 py-3 bg-[#f8fafc]">
                  {t.description && (
                    <p className="text-sm text-[#475569] mb-3">
                      {t.description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        PRIORITY_COLORS[t.priority] || "bg-[#f1f5f9]"
                      }`}
                    >
                      {t.priority} priority
                    </span>
                  </div>
                  {t.status !== "resolved" && t.status !== "cancelled" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleResolve(t.id);
                      }}
                      className="w-full rounded-lg bg-green-600 px-4 py-3 text-sm font-medium text-white hover:bg-green-700 active:bg-green-800"
                    >
                      Mark as Resolved
                    </button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
