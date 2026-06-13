"use client";

import { useEffect, useState } from "react";

interface Unit {
  id: string;
  name: string;
  unitKind: string;
  isRentable: boolean;
  rentalType: string | null;
  city: string | null;
  status: string;
  createdAt: string;
}

export default function UnitsPage() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    unit_kind: "apartment",
    is_rentable: true,
    rental_type: "long_term",
    address_line1: "",
    city: "",
  });
  const [error, setError] = useState("");

  useEffect(() => {
    fetchUnits();
  }, []);

  async function fetchUnits() {
    const res = await fetch("/api/v1/units");
    if (res.ok) {
      const data = await res.json();
      setUnits(data.data);
    }
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/v1/units", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setShowForm(false);
      setForm({ name: "", unit_kind: "apartment", is_rentable: true, rental_type: "long_term", address_line1: "", city: "" });
      fetchUnits();
    } else {
      const data = await res.json();
      setError(data.error?.message || "Failed to create unit");
    }
  }

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold uppercase tracking-wide">Units</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-[#d97706] text-white px-4 py-2 hover:bg-[#b45309]"
        >
          {showForm ? "Cancel" : "New Unit"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border p-4 mb-6 space-y-3">
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="Unit name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="border px-3 py-2"
              required
            />
            <select
              value={form.unit_kind}
              onChange={(e) => setForm({ ...form, unit_kind: e.target.value })}
              className="border px-3 py-2"
            >
              <option value="apartment">Apartment</option>
              <option value="house">House</option>
              <option value="vacation_property">Vacation Property</option>
              <option value="commercial_building">Commercial Building</option>
              <option value="commercial_unit">Commercial Unit</option>
              <option value="room">Room</option>
            </select>
            <select
              value={form.rental_type}
              onChange={(e) => setForm({ ...form, rental_type: e.target.value })}
              className="border px-3 py-2"
            >
              <option value="long_term">Long Term</option>
              <option value="short_term">Short Term</option>
              <option value="both">Both</option>
            </select>
            <input
              placeholder="Address"
              value={form.address_line1}
              onChange={(e) => setForm({ ...form, address_line1: e.target.value })}
              className="border px-3 py-2"
            />
            <input
              placeholder="City"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="border px-3 py-2"
            />
          </div>
          <button type="submit" className="bg-[#d97706] text-white px-4 py-2 hover:bg-[#b45309]">
            Create Unit
          </button>
        </form>
      )}

      <div className="bg-white border">
        <table className="w-full text-sm">
          <thead className="bg-[#f8fafc] border-b">
            <tr>
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Type</th>
              <th className="text-left p-3">Rental</th>
              <th className="text-left p-3">City</th>
              <th className="text-left p-3">Rentable</th>
            </tr>
          </thead>
          <tbody>
            {units.map((unit) => (
              <tr key={unit.id} className="border-b hover:bg-[#f8fafc]">
                <td className="p-3 font-medium">{unit.name}</td>
                <td className="p-3">{unit.unitKind.replace(/_/g, " ")}</td>
                <td className="p-3">{unit.rentalType?.replace(/_/g, " ") ?? "—"}</td>
                <td className="p-3">{unit.city || "—"}</td>
                <td className="p-3">{unit.isRentable ? "Yes" : "No"}</td>
              </tr>
            ))}
            {units.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-[#64748b]">No units yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
