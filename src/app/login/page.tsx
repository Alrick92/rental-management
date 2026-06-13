"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error?.message ?? "Login failed");
        return;
      }

      if (data.user.password_must_change) {
        router.push("/change-password");
      } else {
        const portalRoutes: Record<string, string> = {
          org_admin: "/dashboard",
          property_manager: "/dashboard",
          agent: "/dashboard",
          landlord: "/landlord",
          tenant: "/tenant",
          maintenance_staff: "/maintenance",
          vendor: "/maintenance",
        };
        router.push(portalRoutes[data.user.role] ?? "/dashboard");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f8fafc]">
      <div className="bg-[#1a365d] py-6">
        <h1 className="text-center text-2xl font-bold tracking-tight text-white">
          RENTAL MANAGER
        </h1>
        <p className="mt-1 text-center text-sm text-slate-300">
          Property Management Platform
        </p>
      </div>

      <div className="flex flex-1 items-start justify-center px-4 pt-16">
        <div className="w-full max-w-sm border border-[#e2e8f0] bg-white p-8 shadow-sm">
          <h2 className="mb-6 text-lg font-bold uppercase tracking-wide text-[#1e293b]">
            Sign In
          </h2>
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="border border-red-200 bg-[#fef2f2] p-3 text-sm text-[#dc2626]">
                {error}
              </div>
            )}
            <div>
              <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wide text-[#64748b]">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full border border-[#cbd5e1] bg-white px-3 py-2.5 text-sm text-[#1e293b]"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wide text-[#64748b]">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full border border-[#cbd5e1] bg-white px-3 py-2.5 text-sm text-[#1e293b]"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#d97706] px-4 py-2.5 text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:bg-[#b45309] disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
