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
      <h2 className="text-xl font-semibold text-gray-900">Documents</h2>
      <p className="mt-2 text-sm text-gray-600">
        Contracts, insurance, and inspection reports for your properties.
      </p>

      {properties.length > 1 && (
        <div className="mt-4">
          <select
            value={selectedProperty}
            onChange={(e) => setSelectedProperty(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
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
        <div className="mt-8 rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          No documents available for this property.
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Filename</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Size</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Uploaded</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {doc.originalFilename}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{formatSize(doc.sizeBytes)}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={`/api/v1/documents/${doc.id}/download`}
                      className="text-sm text-indigo-600 hover:underline"
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
