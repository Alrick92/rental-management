"use client";

import Link from "next/link";

export default function TenantDashboardPage() {
  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900">Welcome</h2>
      <p className="mt-2 text-sm text-gray-600">
        Access your lease, payments, and maintenance requests.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/tenant/lease"
          className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm hover:border-indigo-300 hover:shadow transition"
        >
          <h3 className="text-sm font-medium text-gray-900">Lease</h3>
          <p className="mt-1 text-xs text-gray-500">View your lease details</p>
        </Link>
        <Link
          href="/tenant/payments"
          className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm hover:border-indigo-300 hover:shadow transition"
        >
          <h3 className="text-sm font-medium text-gray-900">Payments</h3>
          <p className="mt-1 text-xs text-gray-500">Submit & track rent payments</p>
        </Link>
        <Link
          href="/tenant/maintenance"
          className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm hover:border-indigo-300 hover:shadow transition"
        >
          <h3 className="text-sm font-medium text-gray-900">Maintenance</h3>
          <p className="mt-1 text-xs text-gray-500">Submit repair requests</p>
        </Link>
        <Link
          href="/tenant/documents"
          className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm hover:border-indigo-300 hover:shadow transition"
        >
          <h3 className="text-sm font-medium text-gray-900">Documents</h3>
          <p className="mt-1 text-xs text-gray-500">Lease docs & notices</p>
        </Link>
      </div>
    </div>
  );
}
