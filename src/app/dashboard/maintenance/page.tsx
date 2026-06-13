"use client";

import { useCallback, useEffect, useState } from "react";

interface Ticket {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  unit: { id: string; name: string };
  reportedBy: { id: string; name: string } | null;
  assignedTo: { id: string; name: string } | null;
  resolvedAt: string | null;
  createdAt: string;
}

interface Unit {
  id: string;
  name: string;
}

const STATUS_COLORS: Record<string, string> = {
  open: "bg-red-100 text-red-800",
  in_progress: "bg-yellow-100 text-yellow-800",
  resolved: "bg-green-100 text-green-800",
  cancelled: "bg-[#f1f5f9] text-[#1e293b]",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-[#f1f5f9] text-[#64748b]",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};

export default function MaintenancePage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ unit_id: "", title: "", description: "", priority: "medium" });
  const [submitting, setSubmitting] = useState(false);

  const loadTickets = useCallback(() => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    fetch(`/api/v1/maintenance-tickets?${params}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setTickets(data.data); })
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => {
    loadTickets();
    fetch("/api/v1/units")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setUnits(data.data); });
  }, [loadTickets]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const res = await fetch("/api/v1/maintenance-tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });
    if (res.ok) {
      setFormData({ unit_id: "", title: "", description: "", priority: "medium" });
      setShowForm(false);
      loadTickets();
    }
    setSubmitting(false);
  }

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold uppercase tracking-wide">Maintenance Tickets</h2>
        <div className="flex gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
          >
            + New Ticket
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border rounded p-4 mb-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <select
              value={formData.unit_id}
              onChange={(e) => setFormData({ ...formData, unit_id: e.target.value })}
              className="border rounded px-3 py-2 text-sm"
              required
            >
              <option value="">Select unit...</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
            <select
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              className="border rounded px-3 py-2 text-sm"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <input
            type="text"
            placeholder="Title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full border rounded px-3 py-2 text-sm"
            required
          />
          <textarea
            placeholder="Description (optional)"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full border rounded px-3 py-2 text-sm"
            rows={3}
          />
          <div className="flex gap-2">
            <button type="submit" disabled={submitting} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
              {submitting ? "Creating..." : "Create Ticket"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="border px-4 py-2 rounded text-sm">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border rounded">
        <table className="w-full text-sm">
          <thead className="bg-[#f8fafc] border-b">
            <tr>
              <th className="text-left p-3">Title</th>
              <th className="text-left p-3">Unit</th>
              <th className="text-left p-3">Priority</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Assigned To</th>
              <th className="text-left p-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((t) => (
              <tr key={t.id} className="border-b hover:bg-[#f8fafc]">
                <td className="p-3 font-medium">{t.title}</td>
                <td className="p-3">{t.unit.name}</td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${PRIORITY_COLORS[t.priority] || ""}`}>
                    {t.priority}
                  </span>
                </td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[t.status] || ""}`}>
                    {t.status.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="p-3">{t.assignedTo?.name || "—"}</td>
                <td className="p-3">{new Date(t.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
            {tickets.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-[#64748b]">No maintenance tickets</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
