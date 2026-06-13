"use client";

import { useEffect, useState } from "react";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
}

const ROLE_OPTIONS = [
  "org_admin",
  "property_manager",
  "agent",
  "landlord",
  "tenant",
  "maintenance_staff",
  "vendor",
];

const ROLE_COLORS: Record<string, string> = {
  org_admin: "bg-purple-100 text-purple-700",
  property_manager: "bg-blue-100 text-blue-700",
  agent: "bg-cyan-100 text-cyan-700",
  landlord: "bg-green-100 text-green-700",
  tenant: "bg-amber-100 text-amber-700",
  maintenance_staff: "bg-orange-100 text-orange-700",
  vendor: "bg-rose-100 text-rose-700",
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", role: "agent" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [resetResult, setResetResult] = useState<{
    userId: string;
    password: string;
  } | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    const res = await fetch("/api/v1/users");
    if (res.ok) {
      const data = await res.json();
      setUsers(data.data);
    }
    setLoading(false);
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setTempPassword("");

    const res = await fetch("/api/v1/users/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = await res.json();
    if (res.ok) {
      setSuccess(`User "${data.user.name}" created.`);
      setTempPassword(data.temporary_password);
      setShowInvite(false);
      setForm({ name: "", email: "", role: "agent" });
      fetchUsers();
    } else {
      setError(data.error?.message || "Failed to invite user");
    }
  }

  async function handleDeactivate(userId: string) {
    if (!confirm("Deactivate this user? They will be logged out immediately.")) return;

    const res = await fetch(`/api/v1/users/${userId}/deactivate`, {
      method: "POST",
    });
    if (res.ok) {
      fetchUsers();
    } else {
      const data = await res.json();
      alert(data.error?.message || "Failed to deactivate user");
    }
  }

  async function handleReactivate(userId: string) {
    const res = await fetch(`/api/v1/users/${userId}/reactivate`, {
      method: "POST",
    });
    if (res.ok) {
      fetchUsers();
    } else {
      const data = await res.json();
      alert(data.error?.message || "Failed to reactivate user");
    }
  }

  async function handleResetPassword(userId: string) {
    if (!confirm("Reset this user's password? They will be logged out.")) return;

    const res = await fetch(`/api/v1/users/${userId}/reset-password`, {
      method: "POST",
    });
    const data = await res.json();
    if (res.ok) {
      setResetResult({ userId, password: data.temporary_password });
    } else {
      alert(data.error?.message || "Failed to reset password");
    }
  }

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold uppercase tracking-wide">User Management</h2>
        <button
          onClick={() => {
            setShowInvite(!showInvite);
            setError("");
            setSuccess("");
            setTempPassword("");
          }}
          className="bg-[#d97706] text-white px-4 py-2 rounded hover:bg-[#b45309] text-sm"
        >
          {showInvite ? "Cancel" : "Invite User"}
        </button>
      </div>

      {success && (
        <div className="mb-4 rounded-md bg-green-50 border border-green-200 p-4">
          <p className="text-sm text-green-800">{success}</p>
        </div>
      )}

      {tempPassword && (
        <div className="mb-4 rounded-md bg-amber-50 border border-amber-200 p-4">
          <p className="text-sm font-medium text-amber-800">Temporary Password</p>
          <p className="mt-1 font-mono text-sm text-amber-900 bg-amber-100 px-2 py-1 rounded select-all">
            {tempPassword}
          </p>
          <p className="mt-1 text-xs text-amber-600">
            Share this with the user. They must change it on first login.
          </p>
        </div>
      )}

      {resetResult && (
        <div className="mb-4 rounded-md bg-amber-50 border border-amber-200 p-4">
          <p className="text-sm font-medium text-amber-800">Password Reset</p>
          <p className="mt-1 font-mono text-sm text-amber-900 bg-amber-100 px-2 py-1 rounded select-all">
            {resetResult.password}
          </p>
          <p className="mt-1 text-xs text-amber-600">
            New temporary password. User must change it on next login.
          </p>
          <button
            onClick={() => setResetResult(null)}
            className="mt-2 text-xs text-amber-700 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {showInvite && (
        <form
          onSubmit={handleInvite}
          className="mb-6 rounded-lg border border-[#e2e8f0] bg-white p-4 space-y-3"
        >
          <h3 className="font-semibold text-[#1e293b]">Invite New User</h3>
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="Full Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="rounded border border-[#cbd5e1] px-3 py-2 text-sm"
            />
            <input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              className="rounded border border-[#cbd5e1] px-3 py-2 text-sm"
            />
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="rounded border border-[#cbd5e1] px-3 py-2 text-sm"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="bg-[#d97706] text-white px-4 py-2 rounded text-sm hover:bg-[#b45309]"
          >
            Send Invite
          </button>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-[#e2e8f0] bg-white">
        <table className="min-w-full divide-y divide-[#e2e8f0] text-sm">
          <thead className="bg-[#f8fafc]">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-[#64748b]">Name</th>
              <th className="px-4 py-3 text-left font-medium text-[#64748b]">Email</th>
              <th className="px-4 py-3 text-left font-medium text-[#64748b]">Role</th>
              <th className="px-4 py-3 text-left font-medium text-[#64748b]">Status</th>
              <th className="px-4 py-3 text-left font-medium text-[#64748b]">Last Login</th>
              <th className="px-4 py-3 text-left font-medium text-[#64748b]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f5f9]">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-[#f8fafc]">
                <td className="px-4 py-3 font-medium text-[#1e293b]">{user.name}</td>
                <td className="px-4 py-3 text-[#64748b]">{user.email}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                      ROLE_COLORS[user.role] || "bg-[#f1f5f9] text-[#475569]"
                    }`}
                  >
                    {user.role.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                      user.status === "active"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {user.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-[#64748b]">
                  {user.lastLoginAt
                    ? new Date(user.lastLoginAt).toLocaleDateString()
                    : "Never"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleResetPassword(user.id)}
                      className="text-xs text-[#1a365d] hover:underline"
                    >
                      Reset Password
                    </button>
                    {user.status === "active" ? (
                      <button
                        onClick={() => handleDeactivate(user.id)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Deactivate
                      </button>
                    ) : (
                      <button
                        onClick={() => handleReactivate(user.id)}
                        className="text-xs text-green-600 hover:underline"
                      >
                        Reactivate
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[#94a3b8]">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
