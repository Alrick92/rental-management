"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
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
      const res = await fetch("/api/v1/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error?.message ?? "Login failed");
        return;
      }

      router.push("/admin");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#0f2440]">
      <div className="bg-[#1a365d] py-6">
        <h1 className="text-center text-2xl font-bold uppercase tracking-wide text-white">
          ADMIN CONSOLE
        </h1>
        <p className="mt-1 text-center text-sm text-slate-400">
          Super-admin access only
        </p>
      </div>

      <div className="flex flex-1 items-start justify-center px-4 pt-16">
        <div className="w-full max-w-sm border border-[#234681] bg-[#1a365d] p-8">
          <h2 className="mb-6 text-lg font-bold uppercase tracking-wide text-white">
            Sign In
          </h2>
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="border border-red-800 bg-red-900/30 p-3 text-sm text-red-300">
                {error}
              </div>
            )}
            <div>
              <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wide uppercase tracking-wide text-slate-400">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full border border-[#234681] bg-[#0f2440] px-3 py-2.5 text-sm text-white"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wide uppercase tracking-wide text-slate-400">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full border border-[#234681] bg-[#0f2440] px-3 py-2.5 text-sm text-white"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#d97706] px-4 py-2.5 text-sm font-bold uppercase tracking-wide uppercase tracking-wide text-white transition-colors hover:bg-[#b45309] disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
