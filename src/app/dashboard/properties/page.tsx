"use client";

import { useEffect, useState } from "react";

interface Property {
  id: string;
  name: string;
  city: string | null;
  region: string | null;
  status: string;
  primaryManager: { id: string; name: string } | null;
  backupManager: { id: string; name: string } | null;
  owners: { contact: { id: string; name: string }; share: number }[];
  _count: { units: number };
  createdAt: string;
}

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", address_line1: "", city: "", region: "" });
  const [error, setError] = useState("");

  useEffect(() => {
    fetchProperties();
  }, []);

  async function fetchProperties() {
    const res = await fetch("/api/v1/properties");
    if (res.ok) {
      const data = await res.json();
      setProperties(data.data);
    }
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/v1/properties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setShowForm(false);
      setForm({ name: "", address_line1: "", city: "", region: "" });
      fetchProperties();
    } else {
      const data = await res.json();
      setError(data.error?.message || "Failed to create property");
    }
  }

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Properties</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
        >
          {showForm ? "Cancel" : "New Property"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border rounded p-4 mb-6 space-y-3">
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="Property name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="border rounded px-3 py-2"
              required
            />
            <input
              placeholder="Address"
              value={form.address_line1}
              onChange={(e) => setForm({ ...form, address_line1: e.target.value })}
              className="border rounded px-3 py-2"
            />
            <input
              placeholder="City"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="border rounded px-3 py-2"
            />
            <input
              placeholder="Region/State"
              value={form.region}
              onChange={(e) => setForm({ ...form, region: e.target.value })}
              className="border rounded px-3 py-2"
            />
          </div>
          <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700">
            Create Property
          </button>
        </form>
      )}

      <div className="bg-white border rounded">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Location</th>
              <th className="text-left p-3">Manager</th>
              <th className="text-left p-3">Owner</th>
              <th className="text-left p-3">Units</th>
            </tr>
          </thead>
          <tbody>
            {properties.map((prop) => (
              <tr key={prop.id} className="border-b hover:bg-gray-50">
                <td className="p-3 font-medium">{prop.name}</td>
                <td className="p-3">{[prop.city, prop.region].filter(Boolean).join(", ") || "—"}</td>
                <td className="p-3">{prop.primaryManager?.name || "Unassigned"}</td>
                <td className="p-3">{prop.owners[0]?.contact.name || "—"}</td>
                <td className="p-3">{prop._count.units}</td>
              </tr>
            ))}
            {properties.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-gray-500">
                  No properties yet. Create your first property to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
