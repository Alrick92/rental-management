"use client";

import { useEffect, useState } from "react";

interface DashboardData {
  occupancy: { total: number; occupied: number; rate: number };
  revenue: { thisMonth: number; lastMonth: number };
  expenses: { thisMonth: number };
  tickets: { open: number };
  payments: {
    pending: number;
    recentPending: { id: string; amount: number; currency: string; contact: string; date: string }[];
  };
  invoices: { overdue: number };
  upcomingCheckIns: { id: string; unit: string; guest: string; date: string }[];
  upcomingCheckOuts: { id: string; unit: string; guest: string; date: string }[];
  announcements: { id: string; title: string; scope: string; publishedAt: string }[];
}

function formatMoney(minor: number) {
  return `$${(minor / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/analytics/dashboard")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setData(d); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6">Loading dashboard...</div>;
  if (!data) return <div className="p-6 text-red-600">Failed to load dashboard data</div>;

  const netIncome = data.revenue.thisMonth - data.expenses.thisMonth;
  const revenueChange = data.revenue.lastMonth > 0
    ? Math.round(((data.revenue.thisMonth - data.revenue.lastMonth) / data.revenue.lastMonth) * 100)
    : 0;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Dashboard</h2>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border rounded-lg p-4">
          <div className="text-sm text-gray-500">Occupancy Rate</div>
          <div className="text-2xl font-bold text-gray-900">{data.occupancy.rate}%</div>
          <div className="text-xs text-gray-400">
            {data.occupancy.occupied} of {data.occupancy.total} units
          </div>
        </div>

        <div className="bg-white border rounded-lg p-4">
          <div className="text-sm text-gray-500">Revenue (This Month)</div>
          <div className="text-2xl font-bold text-green-700">{formatMoney(data.revenue.thisMonth)}</div>
          <div className={`text-xs ${revenueChange >= 0 ? "text-green-600" : "text-red-600"}`}>
            {revenueChange >= 0 ? "+" : ""}{revenueChange}% vs last month
          </div>
        </div>

        <div className="bg-white border rounded-lg p-4">
          <div className="text-sm text-gray-500">Net Income</div>
          <div className={`text-2xl font-bold ${netIncome >= 0 ? "text-green-700" : "text-red-700"}`}>
            {formatMoney(netIncome)}
          </div>
          <div className="text-xs text-gray-400">Revenue − Expenses</div>
        </div>

        <div className="bg-white border rounded-lg p-4">
          <div className="text-sm text-gray-500">Open Tickets</div>
          <div className="text-2xl font-bold text-gray-900">{data.tickets.open}</div>
          <div className="text-xs text-gray-400">Maintenance requests</div>
        </div>
      </div>

      {/* Alert badges */}
      <div className="flex gap-3 mb-8">
        {data.payments.pending > 0 && (
          <a href="/dashboard/payments" className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 text-sm text-yellow-800 hover:bg-yellow-100">
            <span className="font-semibold">{data.payments.pending}</span> pending payment{data.payments.pending !== 1 ? "s" : ""}
          </a>
        )}
        {data.invoices.overdue > 0 && (
          <a href="/dashboard/invoices" className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-800 hover:bg-red-100">
            <span className="font-semibold">{data.invoices.overdue}</span> overdue invoice{data.invoices.overdue !== 1 ? "s" : ""}
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Upcoming check-ins */}
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold text-sm mb-3">Upcoming Check-ins (7 days)</h3>
          {data.upcomingCheckIns.length === 0 ? (
            <div className="text-sm text-gray-400">None scheduled</div>
          ) : (
            <div className="space-y-2">
              {data.upcomingCheckIns.map((ci) => (
                <div key={ci.id} className="flex justify-between text-sm">
                  <span>{ci.unit} — {ci.guest}</span>
                  <span className="text-gray-400">{new Date(ci.date).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming check-outs */}
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold text-sm mb-3">Upcoming Check-outs (7 days)</h3>
          {data.upcomingCheckOuts.length === 0 ? (
            <div className="text-sm text-gray-400">None scheduled</div>
          ) : (
            <div className="space-y-2">
              {data.upcomingCheckOuts.map((co) => (
                <div key={co.id} className="flex justify-between text-sm">
                  <span>{co.unit} — {co.guest}</span>
                  <span className="text-gray-400">{new Date(co.date).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending payments */}
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold text-sm mb-3">Payments Awaiting Approval</h3>
          {data.payments.recentPending.length === 0 ? (
            <div className="text-sm text-gray-400">No pending payments</div>
          ) : (
            <div className="space-y-2">
              {data.payments.recentPending.map((p) => (
                <div key={p.id} className="flex justify-between text-sm">
                  <span>{p.contact}</span>
                  <span className="font-medium">{formatMoney(p.amount)}</span>
                </div>
              ))}
              {data.payments.pending > 5 && (
                <a href="/dashboard/payments" className="text-xs text-indigo-600 hover:underline">
                  View all {data.payments.pending} pending
                </a>
              )}
            </div>
          )}
        </div>

        {/* Recent announcements */}
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold text-sm mb-3">Recent Announcements</h3>
          {data.announcements.length === 0 ? (
            <div className="text-sm text-gray-400">No announcements</div>
          ) : (
            <div className="space-y-2">
              {data.announcements.map((a) => (
                <div key={a.id} className="flex justify-between text-sm">
                  <span>{a.title}</span>
                  <span className="text-xs text-gray-400">{a.scope}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
