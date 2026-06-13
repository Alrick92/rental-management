"use client";

import { useEffect, useState } from "react";

interface Currency {
  id: string;
  code: string;
  symbol: string;
  name: string;
  decimal_places: number;
  is_custom: boolean;
  created_at: string;
}

export default function CurrenciesPage() {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ code: "", symbol: "", name: "", decimal_places: 2 });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      const res = await fetch("/api/v1/currencies");
      if (res.ok && active) {
        setCurrencies(await res.json());
      }
      if (active) setLoading(false);
    }
    load();
    return () => { active = false; };
  }, []);

  async function loadCurrencies() {
    const res = await fetch("/api/v1/currencies");
    if (res.ok) {
      setCurrencies(await res.json());
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    const res = await fetch("/api/v1/currencies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      setSuccess(`Currency ${form.code} created.`);
      setForm({ code: "", symbol: "", name: "", decimal_places: 2 });
      setShowForm(false);
      loadCurrencies();
      setTimeout(() => setSuccess(""), 3000);
    } else {
      const data = await res.json();
      setError(data.error?.message || "Failed to create currency");
    }
  }

  async function handleUpdate(id: string) {
    setError("");
    const currency = currencies.find((c) => c.id === id);
    if (!currency) return;

    const res = await fetch(`/api/v1/currencies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        symbol: form.symbol,
        name: form.name,
        decimal_places: form.decimal_places,
      }),
    });

    if (res.ok) {
      setSuccess(`Currency updated.`);
      setEditingId(null);
      loadCurrencies();
      setTimeout(() => setSuccess(""), 3000);
    } else {
      const data = await res.json();
      setError(data.error?.message || "Failed to update currency");
    }
  }

  async function handleDelete(id: string, code: string) {
    if (!confirm(`Delete custom currency ${code}?`)) return;
    setError("");

    const res = await fetch(`/api/v1/currencies/${id}`, { method: "DELETE" });
    if (res.ok) {
      setSuccess(`Currency ${code} deleted.`);
      loadCurrencies();
      setTimeout(() => setSuccess(""), 3000);
    } else {
      const data = await res.json();
      setError(data.error?.message || "Failed to delete currency");
    }
  }

  function startEdit(currency: Currency) {
    setEditingId(currency.id);
    setForm({ code: currency.code, symbol: currency.symbol, name: currency.name, decimal_places: currency.decimal_places });
  }

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold uppercase tracking-wide">Currencies</h2>
        <button
          onClick={() => { setShowForm(!showForm); setEditingId(null); setForm({ code: "", symbol: "", name: "", decimal_places: 2 }); }}
          className="bg-[#d97706] text-white px-4 py-2 text-sm font-medium hover:bg-[#b45309]"
        >
          {showForm ? "Cancel" : "Add Custom Currency"}
        </button>
      </div>

      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 p-3 text-sm text-green-800">{success}</div>
      )}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 p-3 text-sm text-red-800">{error}</div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 border border-[#e2e8f0] bg-white p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[#1e293b] mb-4">New Custom Currency</h3>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#475569] mb-1 uppercase">Code</label>
              <input
                type="text"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                maxLength={10}
                required
                placeholder="BTC"
                className="w-full border border-[#cbd5e1] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#475569] mb-1 uppercase">Symbol</label>
              <input
                type="text"
                value={form.symbol}
                onChange={(e) => setForm({ ...form, symbol: e.target.value })}
                maxLength={10}
                required
                placeholder="₿"
                className="w-full border border-[#cbd5e1] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#475569] mb-1 uppercase">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                placeholder="Bitcoin"
                className="w-full border border-[#cbd5e1] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#475569] mb-1 uppercase">Decimals</label>
              <input
                type="number"
                value={form.decimal_places}
                onChange={(e) => setForm({ ...form, decimal_places: parseInt(e.target.value) || 0 })}
                min={0}
                max={8}
                className="w-full border border-[#cbd5e1] px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button type="submit" className="mt-4 bg-[#d97706] text-white px-4 py-2 text-sm hover:bg-[#b45309]">
            Create Currency
          </button>
        </form>
      )}

      <div className="border border-[#e2e8f0] bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-[#64748b]">Code</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-[#64748b]">Symbol</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-[#64748b]">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-[#64748b]">Decimals</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-[#64748b]">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-[#64748b]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {currencies.map((c) => (
              <tr key={c.id} className="border-b border-[#e2e8f0] last:border-0">
                {editingId === c.id ? (
                  <>
                    <td className="px-4 py-3 font-mono font-medium">{c.code}</td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={form.symbol}
                        onChange={(e) => setForm({ ...form, symbol: e.target.value })}
                        className="w-16 border border-[#cbd5e1] px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className="w-full border border-[#cbd5e1] px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        value={form.decimal_places}
                        onChange={(e) => setForm({ ...form, decimal_places: parseInt(e.target.value) || 0 })}
                        min={0}
                        max={8}
                        className="w-16 border border-[#cbd5e1] px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-[#64748b]">{c.is_custom ? "Custom" : "Built-in"}</span>
                    </td>
                    <td className="px-4 py-3 flex gap-2">
                      <button onClick={() => handleUpdate(c.id)} className="text-xs text-[#047857] hover:underline">Save</button>
                      <button onClick={() => setEditingId(null)} className="text-xs text-[#64748b] hover:underline">Cancel</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 font-mono font-medium">{c.code}</td>
                    <td className="px-4 py-3">{c.symbol}</td>
                    <td className="px-4 py-3">{c.name}</td>
                    <td className="px-4 py-3">{c.decimal_places}</td>
                    <td className="px-4 py-3">
                      {c.is_custom ? (
                        <span className="text-xs bg-[#d97706]/10 border border-[#d97706] px-2 py-0.5 text-[#d97706]">Custom</span>
                      ) : (
                        <span className="text-xs bg-[#f8fafc] border border-[#e2e8f0] px-2 py-0.5 text-[#64748b]">Built-in</span>
                      )}
                    </td>
                    <td className="px-4 py-3 flex gap-2">
                      <button onClick={() => startEdit(c)} className="text-xs text-[#1a365d] hover:underline">Edit</button>
                      {c.is_custom && (
                        <button onClick={() => handleDelete(c.id, c.code)} className="text-xs text-[#dc2626] hover:underline">Delete</button>
                      )}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
