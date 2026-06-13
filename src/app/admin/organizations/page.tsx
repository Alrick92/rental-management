"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface OrgData {
  id: string;
  name: string;
  slug: string;
  status: string;
  default_currency: string;
  timezone: string;
  user_count: number;
  property_count: number;
  created_at: string;
}

export default function AdminOrganizationsPage() {
  const [orgs, setOrgs] = useState<OrgData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [status, setStatus] = useState("");

  const [fetchKey, setFetchKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/v1/admin/organizations")
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setOrgs(d.data || []); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fetchKey]);

  const fetchOrgs = () => setFetchKey((k) => k + 1);

  const handleCreate = async () => {
    if (!newName || !newSlug) {
      setStatus("Name and slug are required");
      return;
    }
    const res = await fetch("/api/v1/admin/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, slug: newSlug }),
    });
    if (res.ok) {
      setShowCreate(false);
      setNewName("");
      setNewSlug("");
      setStatus("");
      fetchOrgs();
    } else {
      const data = await res.json();
      setStatus(data.error?.message || "Failed to create organization");
    }
  };

  const toggleOrgStatus = async (orgId: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "suspended" : "active";
    const res = await fetch(
      `/api/v1/admin/organizations?id=${orgId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      }
    );
    if (res.ok) fetchOrgs();
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <nav className="border-b border-gray-700 bg-gray-800">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <h1 className="text-lg font-semibold">
            <Link href="/admin" className="text-gray-400 hover:text-white">
              Admin
            </Link>
            {" / "}Organizations
          </h1>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="rounded bg-indigo-600 px-3 py-1.5 text-sm hover:bg-indigo-700"
          >
            New Organization
          </button>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-8">
        {showCreate && (
          <div className="mb-6 rounded-lg border border-gray-700 bg-gray-800 p-6 max-w-lg">
            <h3 className="text-sm font-medium mb-4">Create Organization</h3>
            <div className="space-y-3">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Organization name"
                className="w-full rounded border border-gray-600 bg-gray-700 px-3 py-2 text-sm"
              />
              <input
                type="text"
                value={newSlug}
                onChange={(e) =>
                  setNewSlug(
                    e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-")
                  )
                }
                placeholder="slug (lowercase, hyphens)"
                className="w-full rounded border border-gray-600 bg-gray-700 px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCreate}
                  className="rounded bg-indigo-600 px-3 py-1.5 text-sm hover:bg-indigo-700"
                >
                  Create
                </button>
                <button
                  onClick={() => setShowCreate(false)}
                  className="rounded border border-gray-600 px-3 py-1.5 text-sm hover:bg-gray-700"
                >
                  Cancel
                </button>
              </div>
              {status && (
                <p className="text-sm text-red-400">{status}</p>
              )}
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-gray-400">Loading...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 text-left text-gray-400">
                  <th className="pb-2 pr-4">Name</th>
                  <th className="pb-2 pr-4">Slug</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Users</th>
                  <th className="pb-2 pr-4">Properties</th>
                  <th className="pb-2 pr-4">Currency</th>
                  <th className="pb-2 pr-4">Created</th>
                  <th className="pb-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((org) => (
                  <tr
                    key={org.id}
                    className="border-b border-gray-800"
                  >
                    <td className="py-2 pr-4 font-medium">{org.name}</td>
                    <td className="py-2 pr-4 text-gray-400">{org.slug}</td>
                    <td className="py-2 pr-4">
                      <span
                        className={`rounded px-2 py-0.5 text-xs ${
                          org.status === "active"
                            ? "bg-green-900 text-green-300"
                            : "bg-red-900 text-red-300"
                        }`}
                      >
                        {org.status}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-gray-300">
                      {org.user_count}
                    </td>
                    <td className="py-2 pr-4 text-gray-300">
                      {org.property_count}
                    </td>
                    <td className="py-2 pr-4 text-gray-400">
                      {org.default_currency}
                    </td>
                    <td className="py-2 pr-4 text-gray-400">
                      {new Date(org.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-2">
                      <button
                        onClick={() =>
                          toggleOrgStatus(org.id, org.status)
                        }
                        className={`rounded px-2 py-1 text-xs ${
                          org.status === "active"
                            ? "bg-red-800 hover:bg-red-700 text-red-200"
                            : "bg-green-800 hover:bg-green-700 text-green-200"
                        }`}
                      >
                        {org.status === "active"
                          ? "Suspend"
                          : "Reactivate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
