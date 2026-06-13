"use client";

import { useEffect, useState } from "react";

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

export default function LandlordDocumentsPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState("");
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProperties() {
      const res = await fetch("/api/v1/landlord/financials");
      if (res.ok) {
        const data = await res.json();
        const props = data.properties?.map((p: { property_id: string; property_name: string }) => ({
          id: p.property_id,
          name: p.property_name,
        })) || [];
        setProperties(props);
        if (props.length > 0) {
          setSelectedProperty(props[0].id);
        }
      }
      setLoading(false);
    }
    loadProperties();
  }, []);

  useEffect(() => {
    if (!selectedProperty) return;
    async function loadDocs() {
      const params = new URLSearchParams({
        owner_table: "properties",
        owner_id: selectedProperty,
      });
      const res = await fetch(`/api/v1/documents?${params}`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.data);
      }
    }
    loadDocs();
  }, [selectedProperty]);

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div>
      <h2 className="text-xl font-semibold text-[#1e293b]">Documents</h2>
      <p className="mt-2 text-sm text-[#64748b]">
        Contracts, insurance, and inspection reports for your properties.
      </p>

      {properties.length > 1 && (
        <div className="mt-4">
          <select
            value={selectedProperty}
            onChange={(e) => setSelectedProperty(e.target.value)}
            className="border border-[#cbd5e1] px-3 py-2 text-sm"
          >
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {documents.length === 0 ? (
        <div className="mt-8 border border-[#e2e8f0] bg-white p-8 text-center text-sm text-[#64748b]">
          No documents available for this property.
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto border border-[#e2e8f0] bg-white">
          <table className="min-w-full divide-y divide-[#e2e8f0] text-sm">
            <thead className="bg-[#f8fafc]">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-[#64748b]">Filename</th>
                <th className="px-4 py-3 text-left font-medium text-[#64748b]">Size</th>
                <th className="px-4 py-3 text-left font-medium text-[#64748b]">Uploaded</th>
                <th className="px-4 py-3 text-left font-medium text-[#64748b]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-[#f8fafc]">
                  <td className="px-4 py-3 font-medium text-[#1e293b]">
                    {doc.originalFilename}
                  </td>
                  <td className="px-4 py-3 text-[#64748b]">{formatSize(doc.sizeBytes)}</td>
                  <td className="px-4 py-3 text-[#64748b]">
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={`/api/v1/documents/${doc.id}/download`}
                      className="text-sm text-[#1a365d] hover:underline"
                    >
                      Download
                    </a>
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
