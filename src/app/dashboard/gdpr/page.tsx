"use client";

import { useState, useEffect } from "react";

interface Contact {
  id: string;
  name: string;
  email: string | null;
}

interface GdprRequest {
  id: string;
  contact: { id: string; name: string; email: string | null };
  request_type: string;
  status: string;
  requested_by: { name: string; email: string };
  notes: string | null;
  completed_at: string | null;
  created_at: string;
}

export default function GdprPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [requests, setRequests] = useState<GdprRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContact, setSelectedContact] = useState("");
  const [actionStatus, setActionStatus] = useState("");
  const [exportData, setExportData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/v1/contacts?limit=200")
        .then((r) => r.json())
        .then((d) => setContacts(d.data || [])),
      fetch("/api/v1/gdpr/requests")
        .then((r) => r.json())
        .then((d) => setRequests(d.data || [])),
    ]).finally(() => setLoading(false));
  }, []);

  const handleExport = async () => {
    if (!selectedContact) {
      setActionStatus("Please select a contact");
      return;
    }
    setActionStatus("Generating export...");
    const res = await fetch("/api/v1/gdpr/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contact_id: selectedContact }),
    });
    const data = await res.json();
    if (res.ok) {
      setActionStatus("Export generated successfully");
      setExportData(data.export_data);
      // Refresh requests list
      fetch("/api/v1/gdpr/requests")
        .then((r) => r.json())
        .then((d) => setRequests(d.data || []));
    } else {
      setActionStatus(`Error: ${data.error?.message || "Export failed"}`);
    }
  };

  const handleErase = async () => {
    if (!selectedContact) {
      setActionStatus("Please select a contact");
      return;
    }
    if (
      !confirm(
        "This will permanently anonymize this contact's PII. Financial records will be retained. This cannot be undone. Continue?"
      )
    ) {
      return;
    }
    setActionStatus("Processing erasure...");
    const res = await fetch("/api/v1/gdpr/erase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contact_id: selectedContact,
        reason: "GDPR right to erasure request",
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setActionStatus(
        `Erasure complete. Contact anonymized as "${data.anonymized_name}".`
      );
      setSelectedContact("");
      // Refresh
      fetch("/api/v1/contacts?limit=200")
        .then((r) => r.json())
        .then((d) => setContacts(d.data || []));
      fetch("/api/v1/gdpr/requests")
        .then((r) => r.json())
        .then((d) => setRequests(d.data || []));
    } else {
      setActionStatus(`Error: ${data.error?.message || "Erasure failed"}`);
    }
  };

  const downloadExport = () => {
    if (!exportData) return;
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gdpr-export-${selectedContact}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold uppercase tracking-wide text-[#1e293b]">
          GDPR Data Management
        </h1>
        <p className="text-sm text-[#64748b] mt-1">
          Export or erase personal data for contacts in compliance with GDPR.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="rounded-lg border border-[#e2e8f0] bg-white p-6">
          <h2 className="text-lg font-medium text-[#1e293b] mb-4">
            Data Subject Actions
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#475569] mb-1">
                Select Contact
              </label>
              <select
                value={selectedContact}
                onChange={(e) => {
                  setSelectedContact(e.target.value);
                  setExportData(null);
                  setActionStatus("");
                }}
                className="w-full rounded border border-[#cbd5e1] px-3 py-2 text-sm"
              >
                <option value="">Choose a contact...</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.email ? ` (${c.email})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleExport}
                disabled={!selectedContact}
                className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Export Data
              </button>
              <button
                onClick={handleErase}
                disabled={!selectedContact}
                className="rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
              >
                Erase Data
              </button>
            </div>

            {actionStatus && (
              <p
                className={`text-sm ${
                  actionStatus.startsWith("Error")
                    ? "text-red-600"
                    : "text-green-600"
                }`}
              >
                {actionStatus}
              </p>
            )}

            {exportData && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-[#475569]">
                    Export Preview
                  </h3>
                  <button
                    onClick={downloadExport}
                    className="rounded border border-[#cbd5e1] px-3 py-1 text-xs hover:bg-[#f8fafc]"
                  >
                    Download JSON
                  </button>
                </div>
                <pre className="max-h-64 overflow-auto rounded bg-[#f8fafc] p-3 text-xs text-[#64748b] border">
                  {JSON.stringify(exportData, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-[#e2e8f0] bg-white p-6">
          <h2 className="text-lg font-medium text-[#1e293b] mb-4">
            GDPR Request History
          </h2>

          {loading ? (
            <p className="text-[#94a3b8]">Loading...</p>
          ) : requests.length === 0 ? (
            <p className="text-[#64748b] text-sm">
              No GDPR requests have been made yet.
            </p>
          ) : (
            <div className="space-y-3">
              {requests.map((req) => (
                <div
                  key={req.id}
                  className="rounded border border-[#f1f5f9] p-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-[#1e293b] text-sm">
                        {req.contact.name}
                      </span>
                      <span
                        className={`ml-2 rounded px-2 py-0.5 text-xs ${
                          req.request_type === "export"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {req.request_type}
                      </span>
                    </div>
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${
                        req.status === "completed"
                          ? "bg-green-100 text-green-700"
                          : req.status === "processing"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-[#f1f5f9] text-[#64748b]"
                      }`}
                    >
                      {req.status}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-[#64748b]">
                    By {req.requested_by.name} •{" "}
                    {new Date(req.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
