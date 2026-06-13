"use client";

import { useEffect, useState, type FormEvent } from "react";

interface Invoice {
  id: string;
  periodStart: string;
  periodEnd: string;
  amountDueMinor: number;
  amountPaidMinor: number;
  dueDate: string;
  status: string;
}

interface Payment {
  id: string;
  amountMinor: number;
  currency: string;
  method: string;
  status: string;
  receivedAt: string;
  createdAt: string;
}

function formatCurrency(minor: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(minor / 100);
}

const STATUS_COLORS: Record<string, string> = {
  sent: "bg-blue-100 text-blue-800",
  partially_paid: "bg-yellow-100 text-yellow-800",
  paid: "bg-green-100 text-green-800",
  overdue: "bg-red-100 text-red-800",
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

export default function TenantPaymentsPage() {
  const [balanceDue, setBalanceDue] = useState(0);
  const [currency, setCurrency] = useState("USD");
  const [nextDueDate, setNextDueDate] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("bank_transfer");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    fetchBalance();
  }, []);

  async function fetchBalance() {
    const res = await fetch("/api/v1/tenant/balance");
    if (res.ok) {
      const data = await res.json();
      setBalanceDue(data.balance_due);
      setCurrency(data.currency || "USD");
      setNextDueDate(data.next_due_date);
      setInvoices(data.invoices);
      setPayments(data.payments);
    }
    setLoading(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const amountCents = Math.round(parseFloat(amount) * 100);
    if (isNaN(amountCents) || amountCents <= 0) {
      alert("Please enter a valid amount");
      setSubmitting(false);
      return;
    }

    const res = await fetch("/api/v1/tenant/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount_minor: amountCents,
        currency,
        method,
        reference: reference || undefined,
        notes: notes || undefined,
      }),
    });

    if (res.ok) {
      setShowForm(false);
      setAmount("");
      setReference("");
      setNotes("");
      fetchBalance();
    } else {
      const err = await res.json();
      alert(err.error?.message || "Failed to submit payment");
    }
    setSubmitting(false);
  }

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-6">My Payments</h2>

      {/* Balance Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white border rounded-lg p-4">
          <div className="text-sm text-gray-500">Balance Due</div>
          <div className={`text-2xl font-bold ${balanceDue > 0 ? "text-red-600" : "text-green-600"}`}>
            {formatCurrency(balanceDue)}
          </div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="text-sm text-gray-500">Next Due Date</div>
          <div className="text-2xl font-bold">
            {nextDueDate
              ? new Date(nextDueDate).toLocaleDateString()
              : "—"}
          </div>
        </div>
        <div className="bg-white border rounded-lg p-4 flex items-center justify-center">
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm"
          >
            {showForm ? "Cancel" : "Submit Payment"}
          </button>
        </div>
      </div>

      {/* Payment Submission Form */}
      {showForm && (
        <div className="bg-white border rounded-lg p-6 mb-8">
          <h3 className="text-lg font-medium mb-4">Submit a Payment</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount ($)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Method
              </label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cash">Cash</option>
                <option value="check">Check</option>
                <option value="deposit">Deposit</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reference / Transaction ID
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder="Optional"
              />
            </div>
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 text-sm"
              >
                {submitting ? "Submitting..." : "Submit for Approval"}
              </button>
              <p className="mt-2 text-xs text-gray-500">
                Your payment will be reviewed by a manager before being applied to your balance.
              </p>
            </div>
          </form>
        </div>
      )}

      {/* Outstanding Invoices */}
      {invoices.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-3">Outstanding Invoices</h3>
          <div className="bg-white border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left p-3">Period</th>
                  <th className="text-left p-3">Amount Due</th>
                  <th className="text-left p-3">Paid</th>
                  <th className="text-left p-3">Balance</th>
                  <th className="text-left p-3">Due Date</th>
                  <th className="text-left p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b hover:bg-gray-50">
                    <td className="p-3">
                      {new Date(inv.periodStart).toLocaleDateString()} –{" "}
                      {new Date(inv.periodEnd).toLocaleDateString()}
                    </td>
                    <td className="p-3">{formatCurrency(inv.amountDueMinor)}</td>
                    <td className="p-3">{formatCurrency(inv.amountPaidMinor)}</td>
                    <td className="p-3 font-medium">
                      {formatCurrency(inv.amountDueMinor - inv.amountPaidMinor)}
                    </td>
                    <td className="p-3">
                      {new Date(inv.dueDate).toLocaleDateString()}
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[inv.status] || "bg-gray-100"}`}
                      >
                        {inv.status.replace(/_/g, " ")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payment History */}
      <h3 className="text-lg font-semibold mb-3">Payment History</h3>
      <div className="bg-white border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3">Date</th>
              <th className="text-left p-3">Amount</th>
              <th className="text-left p-3">Method</th>
              <th className="text-left p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-b hover:bg-gray-50">
                <td className="p-3">
                  {new Date(p.receivedAt).toLocaleDateString()}
                </td>
                <td className="p-3 font-medium">
                  {formatCurrency(p.amountMinor)}
                </td>
                <td className="p-3">{p.method.replace(/_/g, " ")}</td>
                <td className="p-3">
                  <span
                    className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[p.status] || "bg-gray-100"}`}
                  >
                    {p.status}
                  </span>
                </td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-gray-500">
                  No payments found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
