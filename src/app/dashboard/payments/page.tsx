"use client";

import { useEffect, useState } from "react";
import { useCurrencies } from "@/hooks/use-currencies";

interface Payment {
  id: string;
  amountMinor: number;
  currency: string;
  method: string;
  status: string;
  receivedAt: string;
  contact: { id: string; name: string } | null;
  lease: { id: string; status: string } | null;
  booking: { id: string; status: string } | null;
  recordedBy: { id: string; name: string };
  approvedBy?: { id: string; name: string } | null;
  rejectedReason?: string | null;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const { format: formatCurrency } = useCurrencies();

  useEffect(() => {
    fetchPayments();
  }, []);

  async function fetchPayments() {
    const res = await fetch("/api/v1/payments");
    if (res.ok) {
      const data = await res.json();
      setPayments(data.data);
    }
    setLoading(false);
  }

  async function handleApprove(id: string) {
    const res = await fetch(`/api/v1/payments/${id}/approve`, { method: "POST" });
    if (res.ok) fetchPayments();
  }

  async function handleReject(id: string) {
    const reason = prompt("Rejection reason:");
    if (!reason) return;
    const res = await fetch(`/api/v1/payments/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (res.ok) fetchPayments();
  }

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h2 className="text-2xl font-bold uppercase tracking-wide mb-6">Payments</h2>
      <div className="bg-white border">
        <table className="w-full text-sm">
          <thead className="bg-[#f8fafc] border-b">
            <tr>
              <th className="text-left p-3">Date</th>
              <th className="text-left p-3">Contact</th>
              <th className="text-left p-3">Amount</th>
              <th className="text-left p-3">Method</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Recorded By</th>
              <th className="text-left p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-b hover:bg-[#f8fafc]">
                <td className="p-3">{new Date(p.receivedAt).toLocaleDateString()}</td>
                <td className="p-3">{p.contact?.name || "—"}</td>
                <td className="p-3 font-medium">{formatCurrency(p.amountMinor, p.currency)}</td>
                <td className="p-3">{p.method.replace(/_/g, " ")}</td>
                <td className="p-3">
                  <span className={`inline-block px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[p.status] || "bg-[#f1f5f9]"}`}>
                    {p.status}
                  </span>
                </td>
                <td className="p-3">{p.recordedBy.name}</td>
                <td className="p-3">
                  {p.status === "pending" && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(p.id)}
                        className="text-xs px-2 py-1 bg-green-600 text-white hover:bg-green-700"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(p.id)}
                        className="text-xs px-2 py-1 bg-red-600 text-white hover:bg-red-700"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-[#64748b]">
                  No payments recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
