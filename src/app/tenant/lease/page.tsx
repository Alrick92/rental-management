"use client";

import { useEffect, useState } from "react";

interface Lease {
  id: string;
  status: string;
  startDate: string;
  endDate: string;
  monthlyRentMinor: number;
  currency: string;
  securityDepositMinor: number;
  rentDueDay: number;
  signedAt: string | null;
  tenantRole: string;
  unit: {
    id: string;
    name: string;
    property: { id: string; name: string };
  };
}

function formatCurrency(minor: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(minor / 100);
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  signed: "bg-blue-100 text-blue-800",
  active: "bg-green-100 text-green-800",
  expired: "bg-yellow-100 text-yellow-800",
  terminated: "bg-red-100 text-red-800",
};

export default function TenantLeasePage() {
  const [leases, setLeases] = useState<Lease[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/v1/tenant/lease");
      if (res.ok) {
        const data = await res.json();
        setLeases(data.leases);
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div>Loading lease details...</div>;

  if (leases.length === 0) {
    return (
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Lease Details</h2>
        <div className="mt-8 rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          No active leases found.
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Lease Details</h2>

      {leases.map((lease) => (
        <div
          key={lease.id}
          className="bg-white border rounded-lg p-6 mb-4"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-medium">
                {lease.unit.property.name} — {lease.unit.name}
              </h3>
              <p className="text-sm text-gray-500">Role: {lease.tenantRole}</p>
            </div>
            <span
              className={`inline-block rounded px-3 py-1 text-xs font-medium ${STATUS_COLORS[lease.status] || "bg-gray-100"}`}
            >
              {lease.status}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-gray-500">Start Date</div>
              <div className="text-sm font-medium">
                {new Date(lease.startDate).toLocaleDateString()}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">End Date</div>
              <div className="text-sm font-medium">
                {new Date(lease.endDate).toLocaleDateString()}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Monthly Rent</div>
              <div className="text-sm font-medium">
                {formatCurrency(lease.monthlyRentMinor)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Rent Due Day</div>
              <div className="text-sm font-medium">
                {lease.rentDueDay}{lease.rentDueDay === 1 ? "st" : lease.rentDueDay === 2 ? "nd" : lease.rentDueDay === 3 ? "rd" : "th"} of each month
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Security Deposit</div>
              <div className="text-sm font-medium">
                {formatCurrency(lease.securityDepositMinor)}
              </div>
            </div>
            {lease.signedAt && (
              <div>
                <div className="text-xs text-gray-500">Signed</div>
                <div className="text-sm font-medium">
                  {new Date(lease.signedAt).toLocaleDateString()}
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
