"use client";

import { useEffect, useState } from "react";

interface Booking {
  id: string;
  status: string;
  checkIn: string;
  checkOut: string;
  nightlyRateMinor: number;
  totalAmountMinor: number;
  currency: string;
  channel: string;
  unit: { id: string; name: string };
  primaryContact: { id: string; name: string; email: string | null };
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  tentative: "bg-[#f1f5f9] text-[#1e293b]",
  confirmed: "bg-blue-100 text-blue-800",
  checked_in: "bg-green-100 text-green-800",
  checked_out: "bg-yellow-100 text-yellow-800",
  cancelled: "bg-red-100 text-red-800",
};

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    fetch(`/api/v1/bookings?${params}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setBookings(data.data); })
      .finally(() => setLoading(false));
  }, [statusFilter]);

  function formatMoney(minor: number, currency: string) {
    return `${(minor / 100).toFixed(2)} ${currency}`;
  }

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold uppercase tracking-wide">Bookings</h2>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="tentative">Tentative</option>
          <option value="confirmed">Confirmed</option>
          <option value="checked_in">Checked In</option>
          <option value="checked_out">Checked Out</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="bg-white border">
        <table className="w-full text-sm">
          <thead className="bg-[#f8fafc] border-b">
            <tr>
              <th className="text-left p-3">Unit</th>
              <th className="text-left p-3">Guest</th>
              <th className="text-left p-3">Check-in</th>
              <th className="text-left p-3">Check-out</th>
              <th className="text-left p-3">Total</th>
              <th className="text-left p-3">Channel</th>
              <th className="text-left p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id} className="border-b hover:bg-[#f8fafc]">
                <td className="p-3 font-medium">{b.unit.name}</td>
                <td className="p-3">{b.primaryContact.name}</td>
                <td className="p-3">{new Date(b.checkIn).toLocaleDateString()}</td>
                <td className="p-3">{new Date(b.checkOut).toLocaleDateString()}</td>
                <td className="p-3">{formatMoney(b.totalAmountMinor, b.currency)}</td>
                <td className="p-3">{b.channel.replace(/_/g, " ")}</td>
                <td className="p-3">
                  <span className={`px-2 py-1 text-xs font-medium ${STATUS_COLORS[b.status] || ""}`}>
                    {b.status.replace(/_/g, " ")}
                  </span>
                </td>
              </tr>
            ))}
            {bookings.length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-[#64748b]">No bookings yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
