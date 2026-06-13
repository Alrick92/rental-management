"use client";

import { useState, useEffect } from "react";


interface OrgData {
  id: string;
  name: string;
  slug: string;
  user_count: number;
}

interface ImpersonationRecord {
  id: string;
  super_admin: { name: string; email: string };
  target_user: { name: string; email: string; role: string };
  organization: { name: string };
  reason: string | null;
  started_at: string;
  ended_at: string | null;
}

export default function ImpersonationPage() {
  const [orgs, setOrgs] = useState<OrgData[]>([]);
  const [selectedOrg, setSelectedOrg] = useState("");
  const [selectedUser, setSelectedUser] = useState("");
  const [reason, setReason] = useState("");
  const [history, setHistory] = useState<ImpersonationRecord[]>([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    fetch("/api/v1/admin/organizations")
      .then((r) => r.json())
      .then((d) => setOrgs(d.data || []));
    fetch("/api/v1/admin/impersonate")
      .then((r) => r.json())
      .then((d) => setHistory(d.data || []));
  }, []);

  const handleImpersonate = async () => {
    if (!selectedUser) {
      setStatus("Please enter a target user ID");
      return;
    }
    setStatus("Starting impersonation...");
    const res = await fetch("/api/v1/admin/impersonate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target_user_id: selectedUser,
        reason: reason || undefined,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setStatus(
        `Now impersonating ${data.target_user.name}. Redirecting...`
      );
      // Redirect to the appropriate portal
      const rolePortals: Record<string, string> = {
        org_admin: "/dashboard",
        property_manager: "/dashboard",
        agent: "/dashboard",
        landlord: "/landlord",
        tenant: "/tenant",
        maintenance_staff: "/maintenance",
        vendor: "/maintenance",
      };
      const portal = rolePortals[data.target_user.role] || "/dashboard";
      setTimeout(() => {
        window.location.href = portal;
      }, 1500);
    } else {
      setStatus(`Error: ${data.error?.message || "Unknown error"}`);
    }
  };

  return (
    <>
      <h2 className="mb-6 text-xl font-bold uppercase tracking-wide text-white">Impersonation</h2>
        <div className="border border-[#234681] bg-[#1a365d] p-6 max-w-lg">
          <h2 className="text-lg font-medium mb-4">Start Impersonation</h2>
          <p className="text-sm text-[#94a3b8] mb-4">
            Enter an organization as a specific user for support purposes.
            All actions are audit-logged.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-300 mb-1">
                Organization
              </label>
              <select
                value={selectedOrg}
                onChange={(e) => setSelectedOrg(e.target.value)}
                className="w-full border border-[#234681] bg-[#234681] px-3 py-2 text-sm"
              >
                <option value="">Select an organization...</option>
                {orgs.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name} ({org.user_count} users)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-1">
                Target User ID
              </label>
              <input
                type="text"
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                placeholder="Enter UUID of the user to impersonate"
                className="w-full border border-[#234681] bg-[#234681] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-1">
                Reason (optional)
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why are you impersonating this user?"
                className="w-full border border-[#234681] bg-[#234681] px-3 py-2 text-sm"
              />
            </div>

            <button
              onClick={handleImpersonate}
              className="bg-yellow-600 px-4 py-2 text-sm font-medium hover:bg-yellow-700"
            >
              Start Impersonation
            </button>

            {status && (
              <p className="text-sm text-yellow-300 mt-2">{status}</p>
            )}
          </div>
        </div>

        <div className="mt-8">
          <h3 className="text-lg font-medium mb-4">
            Impersonation History
          </h3>
          {history.length === 0 ? (
            <p className="text-[#94a3b8] text-sm">No impersonation sessions yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#234681] text-left text-[#94a3b8]">
                    <th className="pb-2 pr-4">Admin</th>
                    <th className="pb-2 pr-4">Target</th>
                    <th className="pb-2 pr-4">Org</th>
                    <th className="pb-2 pr-4">Reason</th>
                    <th className="pb-2 pr-4">Started</th>
                    <th className="pb-2">Ended</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((s) => (
                    <tr
                      key={s.id}
                      className="border-b border-[#1a365d]"
                    >
                      <td className="py-2 pr-4">{s.super_admin.name}</td>
                      <td className="py-2 pr-4">
                        {s.target_user.name}
                        <span className="ml-1 text-xs text-[#64748b]">
                          ({s.target_user.role})
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-slate-300">
                        {s.organization.name}
                      </td>
                      <td className="py-2 pr-4 text-[#94a3b8]">
                        {s.reason || "—"}
                      </td>
                      <td className="py-2 pr-4 text-slate-300">
                        {new Date(s.started_at).toLocaleString()}
                      </td>
                      <td className="py-2">
                        {s.ended_at ? (
                          <span className="text-green-400">
                            {new Date(s.ended_at).toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-yellow-400">Active</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
    </>
  );
}
