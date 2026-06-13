"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Property {
  id: string;
  name: string;
  city: string | null;
  region: string | null;
  _count: { units: number };
}

export default function LandlordPortalPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/v1/properties");
      if (res.ok) {
        const data = await res.json();
        setProperties(data.data);
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div>
      <h2 className="text-xl font-semibold text-[#1e293b]">My Properties</h2>
      <p className="mt-2 text-sm text-[#64748b]">
        View your property portfolio and performance.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {properties.map((prop) => (
          <div
            key={prop.id}
            className="rounded-lg border border-[#e2e8f0] bg-white p-6 shadow-sm"
          >
            <h3 className="text-sm font-medium text-[#1e293b]">{prop.name}</h3>
            <p className="mt-1 text-xs text-[#64748b]">
              {[prop.city, prop.region].filter(Boolean).join(", ") || "No location"}
            </p>
            <p className="mt-2 text-xs text-[#64748b]">{prop._count.units} unit(s)</p>
          </div>
        ))}
        {properties.length === 0 && (
          <p className="text-sm text-[#64748b] col-span-3">
            No properties assigned to your account yet.
          </p>
        )}
      </div>

      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
        <Link
          href="/landlord/financials"
          className="rounded-lg border border-[#e2e8f0] bg-white p-6 shadow-sm hover:border-[#234681] hover:shadow transition"
        >
          <h3 className="text-sm font-medium text-[#1e293b]">Financials</h3>
          <p className="mt-1 text-xs text-[#64748b]">Income, expenses, ROI</p>
        </Link>
        <Link
          href="/landlord/maintenance"
          className="rounded-lg border border-[#e2e8f0] bg-white p-6 shadow-sm hover:border-[#234681] hover:shadow transition"
        >
          <h3 className="text-sm font-medium text-[#1e293b]">Maintenance</h3>
          <p className="mt-1 text-xs text-[#64748b]">Repair requests and costs</p>
        </Link>
        <Link
          href="/landlord/documents"
          className="rounded-lg border border-[#e2e8f0] bg-white p-6 shadow-sm hover:border-[#234681] hover:shadow transition"
        >
          <h3 className="text-sm font-medium text-[#1e293b]">Documents</h3>
          <p className="mt-1 text-xs text-[#64748b]">Contracts, reports, inspections</p>
        </Link>
      </div>
    </div>
  );
}
