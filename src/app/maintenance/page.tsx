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
  urgent: "bg-red-100 text-red-800",
  high: "bg-orange-100 text-orange-800",
  medium: "bg-yellow-100 text-yellow-800",
  low: "bg-green-100 text-green-800",
};

export default function MaintenanceWorkOrdersPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900">Work Orders</h2>
      <p className="mt-2 text-sm text-gray-600">
        View and manage your assigned maintenance tasks.
      </p>

      <div className="mt-6 bg-white border rounded">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3">Title</th>
              <th className="text-left p-3">Unit</th>
              <th className="text-left p-3">Priority</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((t) => (
              <tr key={t.id} className="border-b hover:bg-gray-50">
                <td className="p-3 font-medium">{t.title}</td>
                <td className="p-3">{t.unit.name}</td>
                <td className="p-3">
                  <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${PRIORITY_COLORS[t.priority] || "bg-gray-100"}`}>
                    {t.priority}
                  </span>
                </td>
                <td className="p-3">{t.status.replace(/_/g, " ")}</td>
                <td className="p-3">{new Date(t.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
            {tickets.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-gray-500">
                  No work orders assigned yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
