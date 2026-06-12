"use client";

import { useCallback, useEffect, useState } from "react";

interface Cleaning {
  id: string;
  scheduledDate: string;
  status: string;
  notes: string | null;
  unit: { id: string; name: string };
  booking: { id: string; checkIn: string; checkOut: string } | null;
  assignedTo: { id: string; name: string } | null;
  createdAt: string;
}

interface Unit {
  id: string;
  name: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  in_progress: "bg-blue-100 text-blue-800",
  done: "bg-green-100 text-green-800",
};

export default function CleaningPage() {
  const [cleanings, setCleanings] = useState<Cleaning[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ unit_id: "", scheduled_date: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);

  const loadCleanings = useCallback(() => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    fetch(`/api/v1/cleaning-schedules?${params}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setCleanings(data.data); })
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => {
    loadCleanings();
    fetch("/api/v1/units")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setUnits(data.data); });
  }, [loadCleanings]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const res = await fetch("/api/v1/cleaning-schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });
    if (res.ok) {
      setFormData({ unit_id: "", scheduled_date: "", notes: "" });
      setShowForm(false);
      loadCleanings();
    }
    setSubmitting(false);
  }

  async function markDone(id: string) {
    const res = await fetch(`/api/v1/cleaning-schedules/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done" }),
    });
    if (res.ok) loadCleanings();
  }

  async function markInProgress(id: string) {
    const res = await fetch(`/api/v1/cleaning-schedules/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "in_progress" }),
    });
    if (res.ok) loadCleanings();
  }

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Cleaning Schedule</h2>
        <div className="flex gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="done">Done</option>
          </select>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
          >
            + Schedule Cleaning
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
            <input
              type="date"
              value={formData.scheduled_date}
              onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
              className="border rounded px-3 py-2 text-sm"
              required
            />
          </div>
          <textarea
            placeholder="Notes (optional)"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="w-full border rounded px-3 py-2 text-sm"
            rows={2}
          />
          <div className="flex gap-2">
            <button type="submit" disabled={submitting} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
              {submitting ? "Scheduling..." : "Schedule Cleaning"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="border px-4 py-2 rounded text-sm">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border rounded">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3">Date</th>
              <th className="text-left p-3">Unit</th>
              <th className="text-left p-3">Booking</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Assigned To</th>
              <th className="text-left p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {cleanings.map((c) => (
              <tr key={c.id} className="border-b hover:bg-gray-50">
                <td className="p-3 font-medium">{new Date(c.scheduledDate).toLocaleDateString()}</td>
                <td className="p-3">{c.unit.name}</td>
                <td className="p-3">
                  {c.booking
                    ? `${new Date(c.booking.checkIn).toLocaleDateString()} – ${new Date(c.booking.checkOut).toLocaleDateString()}`
                    : "—"}
                </td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[c.status] || ""}`}>
                    {c.status.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="p-3">{c.assignedTo?.name || "—"}</td>
                <td className="p-3">
                  <div className="flex gap-1">
                    {c.status === "pending" && (
                      <button
                        onClick={() => markInProgress(c.id)}
                        className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded hover:bg-blue-100"
                      >
                        Start
                      </button>
                    )}
                    {(c.status === "pending" || c.status === "in_progress") && (
                      <button
                        onClick={() => markDone(c.id)}
                        className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded hover:bg-green-100"
                      >
                        Mark Done
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {cleanings.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-gray-500">No cleaning schedules — they are auto-created when bookings check out</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
