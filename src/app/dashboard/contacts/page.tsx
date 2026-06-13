"use client";

import { useEffect, useState, useRef } from "react";

interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  createdAt: string;
}

interface BulkResult {
  index: number;
  status: "created" | "skipped";
  contact_id?: string;
  reason?: string;
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [error, setError] = useState("");
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkResults, setBulkResults] = useState<BulkResult[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  function parseCSV(text: string): Array<{ name: string; email?: string; phone?: string }> {
    const lines = text.split("\n").filter((l) => l.trim());
    if (lines.length < 2) return [];

    const header = lines[0]!.split(",").map((h) => h.trim().toLowerCase());
    const nameIdx = header.indexOf("name");
    const emailIdx = header.indexOf("email");
    const phoneIdx = header.indexOf("phone");

    if (nameIdx === -1) return [];

    return lines.slice(1).map((line) => {
      const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      const entry: { name: string; email?: string; phone?: string } = {
        name: cols[nameIdx] || "",
      };
      if (emailIdx !== -1 && cols[emailIdx]) entry.email = cols[emailIdx];
      if (phoneIdx !== -1 && cols[phoneIdx]) entry.phone = cols[phoneIdx];
      return entry;
    }).filter((e) => e.name);
  }

  async function handleBulkUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setBulkStatus("Parsing CSV...");
    setBulkResults(null);

    const text = await file.text();
    const contacts = parseCSV(text);

    if (contacts.length === 0) {
      setBulkStatus("Error: No valid contacts found. CSV must have a 'name' column header.");
      return;
    }

    setBulkStatus(`Importing ${contacts.length} contacts...`);

    const res = await fetch("/api/v1/bulk/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contacts }),
    });

    const data = await res.json();
    if (res.ok) {
      setBulkStatus(
        `Import complete: ${data.created} created, ${data.skipped} skipped`
      );
      setBulkResults(data.results);
      fetchContacts();
    } else {
      setBulkStatus(`Error: ${data.error?.message || "Import failed"}`);
    }

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold uppercase tracking-wide">Contacts</h2>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setShowBulk(!showBulk);
              setShowForm(false);
            }}
            className="bg-amber-600 text-white px-4 py-2 hover:bg-amber-700 text-sm"
          >
            {showBulk ? "Cancel Import" : "Bulk Import"}
          </button>
          <button
            onClick={() => {
              setShowForm(!showForm);
              setShowBulk(false);
            }}
            className="bg-[#d97706] text-white px-4 py-2 hover:bg-[#b45309] text-sm"
          >
            {showForm ? "Cancel" : "New Contact"}
          </button>
        </div>
      </div>

      <form onSubmit={handleSearch} className="mb-4 flex gap-2">
        <input
          placeholder="Search by name, email, or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border px-3 py-2 flex-1"
        />
        <button type="submit" className="bg-[#e2e8f0] px-4 py-2 hover:bg-[#cbd5e1]">
          Search
        </button>
      </form>

      {showBulk && (
        <div className="bg-white border p-4 mb-6">
          <h3 className="text-sm font-medium mb-2">
            Bulk Import Contacts from CSV
          </h3>
          <p className="text-xs text-[#64748b] mb-3">
            Upload a CSV file with columns: name, email, phone.
            The &ldquo;name&rdquo; column is required. Duplicate emails will be
            skipped.
          </p>
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleBulkUpload}
              className="text-sm"
            />
          </div>
          {bulkStatus && (
            <p
              className={`mt-3 text-sm ${
                bulkStatus.startsWith("Error")
                  ? "text-red-600"
                  : "text-green-600"
              }`}
            >
              {bulkStatus}
            </p>
          )}
          {bulkResults && bulkResults.some((r) => r.status === "skipped") && (
            <details className="mt-2">
              <summary className="text-xs text-[#64748b] cursor-pointer">
                View skipped entries
              </summary>
              <ul className="mt-1 text-xs text-[#64748b] space-y-0.5">
                {bulkResults
                  .filter((r) => r.status === "skipped")
                  .map((r) => (
                    <li key={r.index}>
                      Row {r.index + 1}: {r.reason}
                    </li>
                  ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border p-4 mb-6 space-y-3">
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="grid grid-cols-3 gap-3">
            <input
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="border px-3 py-2"
              required
            />
            <input
              placeholder="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="border px-3 py-2"
            />
            <input
              placeholder="Phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="border px-3 py-2"
            />
          </div>
          <button type="submit" className="bg-[#d97706] text-white px-4 py-2 hover:bg-[#b45309]">
            Create Contact
          </button>
        </form>
      )}

      <div className="bg-white border">
        <table className="w-full text-sm">
          <thead className="bg-[#f8fafc] border-b">
            <tr>
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Email</th>
              <th className="text-left p-3">Phone</th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((c) => (
              <tr key={c.id} className="border-b hover:bg-[#f8fafc]">
                <td className="p-3 font-medium">{c.name}</td>
                <td className="p-3">{c.email || "—"}</td>
                <td className="p-3">{c.phone || "—"}</td>
              </tr>
            ))}
            {contacts.length === 0 && (
              <tr><td colSpan={3} className="p-6 text-center text-[#64748b]">No contacts yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
