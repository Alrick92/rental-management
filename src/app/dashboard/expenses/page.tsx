"use client";

import { useEffect, useState } from "react";

interface Expense {
  id: string;
  category: string;
  description: string | null;
  amountMinor: number;
  currency: string;
  expenseDate: string;
  createdBy: { id: string; name: string };
}

function formatCurrency(minor: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(minor / 100);
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    category: "",
    description: "",
    amount_minor: 0,
    currency: "USD",
    expense_date: new Date().toISOString().split("T")[0],
  });
  const [error, setError] = useState("");

  useEffect(() => {
    fetchExpenses();
  }, []);

  async function fetchExpenses() {
    const res = await fetch("/api/v1/expenses");
    if (res.ok) {
      const data = await res.json();
      setExpenses(data.data);
    }
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/v1/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setShowForm(false);
      setForm({ category: "", description: "", amount_minor: 0, currency: "USD", expense_date: new Date().toISOString().split("T")[0] });
      fetchExpenses();
    } else {
      const data = await res.json();
      setError(data.error?.message || "Failed to create expense");
    }
  }

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Expenses</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
        >
          {showForm ? "Cancel" : "New Expense"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border rounded p-4 mb-6 space-y-3">
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="Category (e.g., repairs, utilities)"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="border rounded px-3 py-2"
              required
            />
            <input
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="border rounded px-3 py-2"
            />
            <input
              type="number"
              placeholder="Amount (cents)"
              value={form.amount_minor || ""}
              onChange={(e) => setForm({ ...form, amount_minor: parseInt(e.target.value) || 0 })}
              className="border rounded px-3 py-2"
              required
            />
            <input
              type="date"
              value={form.expense_date}
              onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
              className="border rounded px-3 py-2"
              required
            />
          </div>
          <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700">
            Create Expense
          </button>
        </form>
      )}

      <div className="bg-white border rounded">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3">Date</th>
              <th className="text-left p-3">Category</th>
              <th className="text-left p-3">Description</th>
              <th className="text-left p-3">Amount</th>
              <th className="text-left p-3">By</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((exp) => (
              <tr key={exp.id} className="border-b hover:bg-gray-50">
                <td className="p-3">{new Date(exp.expenseDate).toLocaleDateString()}</td>
                <td className="p-3">{exp.category}</td>
                <td className="p-3">{exp.description || "—"}</td>
                <td className="p-3 font-medium">{formatCurrency(exp.amountMinor, exp.currency)}</td>
                <td className="p-3">{exp.createdBy.name}</td>
              </tr>
            ))}
            {expenses.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-gray-500">
                  No expenses recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
