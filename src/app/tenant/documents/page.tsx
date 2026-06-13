"use client";

import { useEffect, useState } from "react";

interface Document {
  id: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  uploadedBy: { id: string; name: string };
}

interface LeaseInfo {
  id: string;
  unit_name: string;
  start_date: string;
  end_date: string;
}

export default function TenantDocumentsPage() {
  const [leaseDoc, setLeaseDoc] = useState<Document[]>([]);
  const [leaseInfo, setLeaseInfo] = useState<LeaseInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLeaseAndDocs() {
      const leaseRes = await fetch("/api/v1/tenant/lease");
      if (leaseRes.ok) {
        const data = await leaseRes.json();
        if (data.lease) {
          setLeaseInfo({
            id: data.lease.id,
            unit_name: data.lease.unit?.name || "Unit",
            start_date: data.lease.startDate,
            end_date: data.lease.endDate,
          });

          const docRes = await fetch(
            `/api/v1/documents?owner_table=leases&owner_id=${data.lease.id}`
          );
          if (docRes.ok) {
            const docData = await docRes.json();
            setLeaseDoc(docData.data);
          }
        }
      }
      setLoading(false);
    }
    loadLeaseAndDocs();
  }, []);

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
        Access your lease agreement, notices, and other documents.
      </p>

      {leaseInfo && (
        <div className="mt-4 text-sm text-[#64748b]">
          Lease for <span className="font-medium">{leaseInfo.unit_name}</span> (
          {leaseInfo.start_date?.slice(0, 10)} – {leaseInfo.end_date?.slice(0, 10)})
        </div>
      )}

      {leaseDoc.length === 0 ? (
        <div className="mt-8 border border-[#e2e8f0] bg-white p-8 text-center text-sm text-[#64748b]">
          {leaseInfo
            ? "No documents have been uploaded for your lease yet."
            : "No active lease found."}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {leaseDoc.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between border border-[#e2e8f0] bg-white px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-[#1e293b]">
                  {doc.originalFilename}
                </p>
                <p className="text-xs text-[#64748b]">
                  {formatSize(doc.sizeBytes)} &middot;{" "}
                  {new Date(doc.createdAt).toLocaleDateString()}
                </p>
              </div>
              <a
                href={`/api/v1/documents/${doc.id}/download`}
                className="bg-[#d97706] px-3 py-1.5 text-xs text-white hover:bg-[#b45309]"
              >
                Download
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
