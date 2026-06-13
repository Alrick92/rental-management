"use client";

import { useEffect, useState } from "react";

interface PropertySummary {
  id: string;
  name: string;
  totalUnits: number;
  occupiedUnits: number;
  revenue: number;
  expenses: number;
  netIncome: number;
  outstandingBalance: number;
}

interface ReportData {
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  totalUnits: number;
  occupiedUnits: number;
  occupancyRate: number;
  totalOutstanding: number;
  properties: PropertySummary[];
}

function formatCurrency(minor: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(minor / 100);
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchReport() {
      const res = await fetch("/api/v1/reports/financial-summary");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
      setLoading(false);
    }
    fetchReport();
  }, []);

  if (loading) return <div className="p-6">Loading report...</div>;
  if (!data) return <div className="p-6 text-red-500">Failed to load report</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Financial Reports</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border rounded p-4">
          <div className="text-sm text-gray-500">Total Revenue</div>
          <div className="text-2xl font-bold text-green-600">
            {formatCurrency(data.totalRevenue)}
          </div>
        </div>
        <div className="bg-white border rounded p-4">
          <div className="text-sm text-gray-500">Total Expenses</div>
          <div className="text-2xl font-bold text-red-600">
            {formatCurrency(data.totalExpenses)}
          </div>
        </div>
        <div className="bg-white border rounded p-4">
          <div className="text-sm text-gray-500">Net Income</div>
          <div className={`text-2xl font-bold ${data.netIncome >= 0 ? "text-green-600" : "text-red-600"}`}>
            {formatCurrency(data.netIncome)}
          </div>
        </div>
        <div className="bg-white border rounded p-4">
          <div className="text-sm text-gray-500">Occupancy Rate</div>
          <div className="text-2xl font-bold">
            {data.occupancyRate.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-400">
            {data.occupiedUnits} / {data.totalUnits} units
          </div>
        </div>
      </div>

      {/* Outstanding Balance */}
      <div className="bg-yellow-50 border border-yellow-200 rounded p-4 mb-8">
        <div className="text-sm text-yellow-700">Total Outstanding Balance</div>
        <div className="text-xl font-bold text-yellow-800">
          {formatCurrency(data.totalOutstanding)}
        </div>
      </div>

      {/* Per-Property Breakdown */}
      <h3 className="text-lg font-semibold mb-3">Property Breakdown</h3>
      <div className="bg-white border rounded">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3">Property</th>
              <th className="text-left p-3">Units</th>
              <th className="text-left p-3">Occupancy</th>
              <th className="text-left p-3">Revenue</th>
              <th className="text-left p-3">Expenses</th>
              <th className="text-left p-3">Net Income</th>
              <th className="text-left p-3">Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {data.properties.map((prop) => (
              <tr key={prop.id} className="border-b hover:bg-gray-50">
                <td className="p-3 font-medium">{prop.name}</td>
                <td className="p-3">{prop.totalUnits}</td>
                <td className="p-3">
                  {prop.totalUnits > 0
                    ? ((prop.occupiedUnits / prop.totalUnits) * 100).toFixed(0)
                    : 0}
                  %
                </td>
                <td className="p-3 text-green-600">
                  {formatCurrency(prop.revenue)}
                </td>
                <td className="p-3 text-red-600">
                  {formatCurrency(prop.expenses)}
                </td>
                <td className={`p-3 font-medium ${prop.netIncome >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {formatCurrency(prop.netIncome)}
                </td>
                <td className="p-3 text-yellow-700">
                  {formatCurrency(prop.outstandingBalance)}
                </td>
              </tr>
            ))}
            {data.properties.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-500">
                  No properties found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
