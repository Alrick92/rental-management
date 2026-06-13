"use client";

import { useEffect, useState } from "react";

interface PropertyFinancial {
  id: string;
  name: string;
  ownershipShare: number;
  totalUnits: number;
  occupiedUnits: number;
  monthlyRent: number;
  totalIncome: number;
  totalExpenses: number;
  netIncome: number;
}

interface Disbursement {
  id: string;
  property: { id: string; name: string };
  periodStart: string;
  periodEnd: string;
  rentCollectedMinor: number;
  expensesMinor: number;
  managementFeeMinor: number;
  netPayoutMinor: number;
  currency: string;
  status: string;
  confirmedAt: string | null;
}

function formatCurrency(minor: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(minor / 100);
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-[#f1f5f9] text-[#1e293b]",
  confirmed: "bg-green-100 text-green-800",
  paid: "bg-blue-100 text-blue-800",
};

export default function LandlordFinancialsPage() {
  const [properties, setProperties] = useState<PropertyFinancial[]>([]);
  const [disbursements, setDisbursements] = useState<Disbursement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/v1/landlord/financials");
      if (res.ok) {
        const data = await res.json();
        setProperties(data.properties);
        setDisbursements(data.disbursements);
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div>Loading financials...</div>;

  const totalIncome = properties.reduce((s, p) => s + p.totalIncome, 0);
  const totalExpenses = properties.reduce((s, p) => s + p.totalExpenses, 0);
  const netIncome = totalIncome - totalExpenses;

  return (
    <div>
      <h2 className="text-xl font-semibold text-[#1e293b] mb-6">Financial Dashboard</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white border rounded-lg p-4">
          <div className="text-sm text-[#64748b]">Total Income</div>
          <div className="text-2xl font-bold text-green-600">
            {formatCurrency(totalIncome)}
          </div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="text-sm text-[#64748b]">Total Expenses</div>
          <div className="text-2xl font-bold text-red-600">
            {formatCurrency(totalExpenses)}
          </div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="text-sm text-[#64748b]">Net Income</div>
          <div className={`text-2xl font-bold ${netIncome >= 0 ? "text-green-600" : "text-red-600"}`}>
            {formatCurrency(netIncome)}
          </div>
        </div>
      </div>

      {/* Per-Property Breakdown */}
      <h3 className="text-lg font-semibold mb-3">Properties</h3>
      <div className="bg-white border rounded-lg mb-8">
        <table className="w-full text-sm">
          <thead className="bg-[#f8fafc] border-b">
            <tr>
              <th className="text-left p-3">Property</th>
              <th className="text-left p-3">Share</th>
              <th className="text-left p-3">Units</th>
              <th className="text-left p-3">Monthly Rent</th>
              <th className="text-left p-3">Income</th>
              <th className="text-left p-3">Expenses</th>
              <th className="text-left p-3">Net</th>
            </tr>
          </thead>
          <tbody>
            {properties.map((prop) => (
              <tr key={prop.id} className="border-b hover:bg-[#f8fafc]">
                <td className="p-3 font-medium">{prop.name}</td>
                <td className="p-3">{prop.ownershipShare}%</td>
                <td className="p-3">
                  {prop.occupiedUnits}/{prop.totalUnits}
                </td>
                <td className="p-3">{formatCurrency(prop.monthlyRent)}</td>
                <td className="p-3 text-green-600">
                  {formatCurrency(prop.totalIncome)}
                </td>
                <td className="p-3 text-red-600">
                  {formatCurrency(prop.totalExpenses)}
                </td>
                <td className={`p-3 font-medium ${prop.netIncome >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {formatCurrency(prop.netIncome)}
                </td>
              </tr>
            ))}
            {properties.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-[#64748b]">
                  No properties found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Disbursements */}
      <h3 className="text-lg font-semibold mb-3">Disbursements</h3>
      <div className="bg-white border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-[#f8fafc] border-b">
            <tr>
              <th className="text-left p-3">Property</th>
              <th className="text-left p-3">Period</th>
              <th className="text-left p-3">Rent Collected</th>
              <th className="text-left p-3">Expenses</th>
              <th className="text-left p-3">Mgmt Fee</th>
              <th className="text-left p-3">Net Payout</th>
              <th className="text-left p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {disbursements.map((d) => (
              <tr key={d.id} className="border-b hover:bg-[#f8fafc]">
                <td className="p-3 font-medium">{d.property.name}</td>
                <td className="p-3">
                  {new Date(d.periodStart).toLocaleDateString()} –{" "}
                  {new Date(d.periodEnd).toLocaleDateString()}
                </td>
                <td className="p-3">{formatCurrency(d.rentCollectedMinor)}</td>
                <td className="p-3">{formatCurrency(d.expensesMinor)}</td>
                <td className="p-3">{formatCurrency(d.managementFeeMinor)}</td>
                <td className="p-3 font-medium text-green-600">
                  {formatCurrency(d.netPayoutMinor)}
                </td>
                <td className="p-3">
                  <span
                    className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[d.status] || "bg-[#f1f5f9]"}`}
                  >
                    {d.status}
                  </span>
                </td>
              </tr>
            ))}
            {disbursements.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-[#64748b]">
                  No disbursements yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
