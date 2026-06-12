"use client";

import { useEffect, useState } from "react";

interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  createdAt: string;
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [error, setError] = useState("");

  useEffect(() => {
    fetchContacts();
  }, []);

  async function fetchContacts(q?: string) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    const res = await fetch(`/api/v1/contacts?${params}`);
    if (res.ok) {
      const data = await res.json();
      setContacts(data.data);
    }
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const body: Record<string, string> = { name: form.name };
    if (form.email) body.email = form.email;
    if (form.phone) body.phone = form.phone;
    const res = await fetch("/api/v1/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setShowForm(false);
      setForm({ name: "", email: "", phone: "" });
      fetchContacts();
    } else {
      const data = await res.json();
      setError(data.error?.message || "Failed to create contact");
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    fetchContacts(search);
  }

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Contacts</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
        >
          {showForm ? "Cancel" : "New Contact"}
        </button>
      </div>

      <form onSubmit={handleSearch} className="mb-4 flex gap-2">
        <input
          placeholder="Search by name, email, or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded px-3 py-2 flex-1"
        />
        <button type="submit" className="bg-gray-200 px-4 py-2 rounded hover:bg-gray-300">
          Search
        </button>
      </form>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border rounded p-4 mb-6 space-y-3">
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="grid grid-cols-3 gap-3">
            <input
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="border rounded px-3 py-2"
              required
            />
            <input
              placeholder="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="border rounded px-3 py-2"
            />
            <input
              placeholder="Phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="border rounded px-3 py-2"
            />
          </div>
          <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700">
            Create Contact
          </button>
        </form>
      )}

      <div className="bg-white border rounded">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Email</th>
              <th className="text-left p-3">Phone</th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((c) => (
              <tr key={c.id} className="border-b hover:bg-gray-50">
                <td className="p-3 font-medium">{c.name}</td>
                <td className="p-3">{c.email || "—"}</td>
                <td className="p-3">{c.phone || "—"}</td>
              </tr>
            ))}
            {contacts.length === 0 && (
              <tr><td colSpan={3} className="p-6 text-center text-gray-500">No contacts yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
