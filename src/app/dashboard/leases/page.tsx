"use client";

import { useEffect, useState } from "react";

interface Lease {
  id: string;
  status: string;
  startDate: string;
  endDate: string;
  monthlyRentMinor: number;
  currency: string;
  unit: { id: string; name: string };
  tenants: { contact: { id: string; name: string } }[];
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  active: "bg-blue-100 text-blue-800",
  signed: "bg-green-100 text-green-800",
  ended: "bg-yellow-100 text-yellow-800",
  terminated: "bg-red-100 text-red-800",
  cancelled: "bg-gray-200 text-gray-500",
};

export default function LeasesPage() {
  const [leases, setLeases] = useState<Lease[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    fetch(`/api/v1/leases?${params}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setLeases(data.data); })
      .finally(() => setLoading(false));
  }, [statusFilter]);

  function formatMoney(minor: number, currency: string) {
    return `${(minor / 100).toFixed(2)} ${currency}`;
  }

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Leases</h2>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="signed">Signed</option>
            <option value="ended">Ended</option>
            <option value="terminated">Terminated</option>
          </select>
        </div>
      </div>

      <div className="bg-white border rounded">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3">Unit</th>
              <th className="text-left p-3">Tenant(s)</th>
              <th className="text-left p-3">Period</th>
              <th className="text-left p-3">Monthly Rent</th>
              <th className="text-left p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {leases.map((lease) => (
              <tr key={lease.id} className="border-b hover:bg-gray-50">
                <td className="p-3 font-medium">{lease.unit.name}</td>
                <td className="p-3">
                  {lease.tenants.map((t) => t.contact.name).join(", ") || "—"}
                </td>
                <td className="p-3">
                  {new Date(lease.startDate).toLocaleDateString()} — {new Date(lease.endDate).toLocaleDateString()}
                </td>
                <td className="p-3">{formatMoney(lease.monthlyRentMinor, lease.currency)}</td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[lease.status] || ""}`}>
                    {lease.status}
                  </span>
                </td>
              </tr>
            ))}
            {leases.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-gray-500">No leases yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
