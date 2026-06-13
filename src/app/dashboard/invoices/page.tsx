"use client";

import { useEffect, useState } from "react";

interface Invoice {
  id: string;
  periodStart: string;
  periodEnd: string;
  amountDueMinor: number;
  amountPaidMinor: number;
  dueDate: string;
  status: string;
  sentAt: string | null;
  lease: {
    id: string;
    unit: { id: string; name: string };
  };
}

function formatCurrency(minor: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(minor / 100);
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-[#f1f5f9] text-[#1e293b]",
  sent: "bg-blue-100 text-blue-800",
  partially_paid: "bg-yellow-100 text-yellow-800",
  paid: "bg-green-100 text-green-800",
  overdue: "bg-red-100 text-red-800",
  cancelled: "bg-[#f1f5f9] text-[#64748b]",
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkResult, setBulkResult] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    fetchInvoices();
  }, [statusFilter]);

  async function fetchInvoices() {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    const res = await fetch(`/api/v1/invoices?${params}`);
    if (res.ok) {
      const data = await res.json();
      setInvoices(data.data);
    }
    setLoading(false);
  }

  async function handleGenerate() {
    setGenerating(true);
    const res = await fetch("/api/v1/invoices/generate", { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      alert(`Generated ${data.generated} invoice(s)`);
      fetchInvoices();
    } else {
      alert("Failed to generate invoices");
    }
    setGenerating(false);
  }

  async function handleBulkGenerate() {
    setBulkGenerating(true);
    setBulkResult("");
    const res = await fetch("/api/v1/bulk/invoices", { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setBulkResult(
        `Bulk generation complete: ${data.invoices_created} created, ${data.invoices_skipped} skipped (${data.leases_checked} leases checked)`
      );
      fetchInvoices();
    } else {
      setBulkResult(`Error: ${data.error?.message || "Bulk generation failed"}`);
    }
    setBulkGenerating(false);
  }

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold uppercase tracking-wide">Invoices</h2>
        <div className="flex gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="partially_paid">Partially Paid</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </select>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-4 py-2 bg-[#d97706] text-white rounded hover:bg-[#b45309] disabled:opacity-50 text-sm"
          >
            {generating ? "Generating..." : "Generate Invoices"}
          </button>
          <button
            onClick={handleBulkGenerate}
            disabled={bulkGenerating}
            className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50 text-sm"
          >
            {bulkGenerating ? "Processing..." : "Bulk Generate All"}
          </button>
        </div>
      </div>

      {bulkResult && (
        <div
          className={`mb-4 rounded px-4 py-2 text-sm ${
            bulkResult.startsWith("Error")
              ? "bg-red-50 text-red-700"
              : "bg-green-50 text-green-700"
          }`}
        >
          {bulkResult}
        </div>
      )}

      <div className="bg-white border rounded">
        <table className="w-full text-sm">
          <thead className="bg-[#f8fafc] border-b">
            <tr>
              <th className="text-left p-3">Period</th>
              <th className="text-left p-3">Unit</th>
              <th className="text-left p-3">Amount Due</th>
              <th className="text-left p-3">Paid</th>
              <th className="text-left p-3">Balance</th>
              <th className="text-left p-3">Due Date</th>
              <th className="text-left p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-b hover:bg-[#f8fafc]">
                <td className="p-3">
                  {new Date(inv.periodStart).toLocaleDateString()} –{" "}
                  {new Date(inv.periodEnd).toLocaleDateString()}
                </td>
                <td className="p-3">{inv.lease?.unit?.name || "—"}</td>
                <td className="p-3 font-medium">
                  {formatCurrency(inv.amountDueMinor)}
                </td>
                <td className="p-3">{formatCurrency(inv.amountPaidMinor)}</td>
                <td className="p-3 font-medium">
                  {formatCurrency(inv.amountDueMinor - inv.amountPaidMinor)}
                </td>
                <td className="p-3">
                  {new Date(inv.dueDate).toLocaleDateString()}
                </td>
                <td className="p-3">
                  <span
                    className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[inv.status] || "bg-[#f1f5f9]"}`}
                  >
                    {inv.status.replace(/_/g, " ")}
                  </span>
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="p-6 text-center text-[#64748b]"
                >
                  No invoices found. Click &quot;Generate Invoices&quot; to
                  create invoices for active leases.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
