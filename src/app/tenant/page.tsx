"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Announcement {
  id: string;
  title: string;
  body: string;
  publishedAt: string;
}

interface BalanceData {
  balance_due: number;
  currency: string;
  next_due_date: string | null;
}

export default function TenantDashboardPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [balance, setBalance] = useState<BalanceData | null>(null);

  useEffect(() => {
    fetch("/api/v1/announcements?limit=3")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setAnnouncements(d.data); });
    fetch("/api/v1/tenant/balance")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setBalance(d); });
  }, []);

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900">Welcome</h2>
      <p className="mt-2 text-sm text-gray-600">
        Access your lease, payments, and maintenance requests.
      </p>

      {/* Balance summary */}
      {balance && (
        <div className="mt-6 bg-white border rounded-lg p-4 max-w-sm">
          <div className="text-sm text-gray-500">Current Balance</div>
          <div className={`text-2xl font-bold ${balance.balance_due > 0 ? "text-red-600" : "text-green-600"}`}>
            ${(balance.balance_due / 100).toFixed(2)} {balance.currency}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {balance.balance_due > 0 ? "Amount due" : "Paid in full"}
          </div>
        </div>
      )}

      {/* Quick nav cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Lease", href: "/tenant/lease", desc: "View your lease details" },
          { label: "Payments", href: "/tenant/payments", desc: "Submit & track rent payments" },
          { label: "Maintenance", href: "/tenant/maintenance", desc: "Submit repair requests" },
          { label: "Messages", href: "/tenant/messages", desc: "Chat with your manager" },
          { label: "Documents", href: "/tenant/documents", desc: "Lease docs & notices" },
        ].map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:border-indigo-300 hover:shadow transition"
          >
            <h3 className="text-sm font-medium text-gray-900">{item.label}</h3>
            <p className="mt-1 text-xs text-gray-500">{item.desc}</p>
          </Link>
        ))}
      </div>

      {/* Recent announcements */}
      {announcements.length > 0 && (
        <div className="mt-8">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-gray-900">Recent Announcements</h3>
            <Link href="/tenant/announcements" className="text-sm text-indigo-600 hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {announcements.map((a) => (
              <div key={a.id} className="bg-white border rounded-lg p-3">
                <div className="font-medium text-sm">{a.title}</div>
                <p className="text-xs text-gray-600 mt-1 line-clamp-2">{a.body}</p>
                <div className="text-xs text-gray-400 mt-1">
                  {new Date(a.publishedAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
