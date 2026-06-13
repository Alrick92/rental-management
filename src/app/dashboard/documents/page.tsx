"use client";

import { useEffect, useState, useRef } from "react";

interface Document {
  id: string;
  ownerTable: string;
  ownerId: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  uploadedBy: { id: string; name: string };
}

interface Property {
  id: string;
  name: string;
}

interface Lease {
  id: string;
  unit: { name: string };
  startDate: string;
  endDate: string;
}

const OWNER_TYPES = [
  { value: "properties", label: "Property" },
  { value: "leases", label: "Lease" },
  { value: "contacts", label: "Contact" },
  { value: "maintenance_tickets", label: "Maintenance Ticket" },
];

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [ownerType, setOwnerType] = useState("properties");
  const [ownerId, setOwnerId] = useState("");
  const [properties, setProperties] = useState<Property[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadInitial() {
      const [propRes, leaseRes] = await Promise.all([
        fetch("/api/v1/properties?limit=200"),
        fetch("/api/v1/leases?limit=200"),
      ]);
      if (propRes.ok) {
        const data = await propRes.json();
        setProperties(data.data);
        if (data.data.length > 0) {
          setOwnerId(data.data[0].id);
        }
      }
      if (leaseRes.ok) {
        const data = await leaseRes.json();
        setLeases(data.data);
      }
    }
    loadInitial();
  }, []);

  useEffect(() => {
    if (ownerId) fetchDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId, ownerType]);

  async function fetchDocuments() {
    setLoading(true);
    const params = new URLSearchParams({
      owner_table: ownerType,
      owner_id: ownerId,
    });
    const res = await fetch(`/api/v1/documents?${params}`);
    if (res.ok) {
      const data = await res.json();
      setDocuments(data.data);
    }
    setLoading(false);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !ownerId) return;

    setUploading(true);
    setUploadError("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("owner_table", ownerType);
    formData.append("owner_id", ownerId);

    const res = await fetch("/api/v1/documents", {
      method: "POST",
      body: formData,
    });

    setUploading(false);
    if (res.ok) {
      fetchDocuments();
    } else {
      const data = await res.json();
      setUploadError(data.error?.message || "Upload failed");
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleDelete(docId: string) {
    if (!confirm("Delete this document?")) return;

    const res = await fetch(`/api/v1/documents/${docId}`, { method: "DELETE" });
    if (res.ok) {
      fetchDocuments();
    }
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold uppercase tracking-wide mb-6">Documents</h2>

      <div className="mb-6 flex gap-4 items-end">
        <div>
          <label className="block text-sm font-medium text-[#475569] mb-1">
            Owner Type
          </label>
          <select
            value={ownerType}
            onChange={(e) => {
              setOwnerType(e.target.value);
              setOwnerId("");
              setDocuments([]);
            }}
            className="rounded border border-[#cbd5e1] px-3 py-2 text-sm"
          >
            {OWNER_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1">
          <label className="block text-sm font-medium text-[#475569] mb-1">
            {ownerType === "properties"
              ? "Property"
              : ownerType === "leases"
                ? "Lease"
                : "Owner ID"}
          </label>
          {ownerType === "properties" ? (
            <select
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              className="w-full rounded border border-[#cbd5e1] px-3 py-2 text-sm"
            >
              <option value="">Select a property...</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          ) : ownerType === "leases" ? (
            <select
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              className="w-full rounded border border-[#cbd5e1] px-3 py-2 text-sm"
            >
              <option value="">Select a lease...</option>
              {leases.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.unit?.name} ({l.startDate?.slice(0, 10)} - {l.endDate?.slice(0, 10)})
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              placeholder="Enter UUID"
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              className="w-full rounded border border-[#cbd5e1] px-3 py-2 text-sm"
            />
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-[#475569] mb-1">
            Upload
          </label>
          <label
            className={`inline-flex items-center gap-1 rounded px-4 py-2 text-sm text-white cursor-pointer ${
              !ownerId || uploading
                ? "bg-[#94a3b8] cursor-not-allowed"
                : "bg-[#d97706] hover:bg-[#b45309]"
            }`}
          >
            {uploading ? "Uploading..." : "Choose File"}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleUpload}
              disabled={!ownerId || uploading}
            />
          </label>
        </div>
      </div>

      {uploadError && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
          {uploadError}
        </div>
      )}

      {loading ? (
        <div className="text-[#64748b] text-sm">Loading documents...</div>
      ) : documents.length === 0 ? (
        <div className="rounded-lg border border-[#e2e8f0] bg-white p-8 text-center text-sm text-[#64748b]">
          {ownerId
            ? "No documents uploaded yet."
            : "Select an owner to view documents."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[#e2e8f0] bg-white">
          <table className="min-w-full divide-y divide-[#e2e8f0] text-sm">
            <thead className="bg-[#f8fafc]">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-[#64748b]">
                  Filename
                </th>
                <th className="px-4 py-3 text-left font-medium text-[#64748b]">
                  Type
                </th>
                <th className="px-4 py-3 text-left font-medium text-[#64748b]">
                  Size
                </th>
                <th className="px-4 py-3 text-left font-medium text-[#64748b]">
                  Uploaded By
                </th>
                <th className="px-4 py-3 text-left font-medium text-[#64748b]">
                  Date
                </th>
                <th className="px-4 py-3 text-left font-medium text-[#64748b]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-[#f8fafc]">
                  <td className="px-4 py-3 font-medium text-[#1e293b]">
                    {doc.originalFilename}
                  </td>
                  <td className="px-4 py-3 text-[#64748b]">{doc.mimeType}</td>
                  <td className="px-4 py-3 text-[#64748b]">
                    {formatSize(doc.sizeBytes)}
                  </td>
                  <td className="px-4 py-3 text-[#64748b]">
                    {doc.uploadedBy?.name}
                  </td>
                  <td className="px-4 py-3 text-[#64748b]">
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <a
                        href={`/api/v1/documents/${doc.id}/download`}
                        className="text-xs text-[#1a365d] hover:underline"
                      >
                        Download
                      </a>
                      <button
                        onClick={() => handleDelete(doc.id)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
