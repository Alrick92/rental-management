"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthBackground } from "@/components/auth-background";
import { Button } from "@/components/button";

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
    <AuthBackground overlayOpacity={0.5}>
      <div className="w-full max-w-sm">
        {/* Brand header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            RENTAL MANAGER
          </h1>
          <p className="mt-1 text-sm text-slate-300">
            Property Management Platform
          </p>
        </div>

        {/* Login card */}
        <div className="border border-[#e2e8f0] bg-white/95 p-8 shadow-xl backdrop-blur-sm">
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
            <Button
              type="submit"
              disabled={loading}
              variant="primary"
              size="lg"
              className="w-full"
            >
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </div>
      </div>
    </AuthBackground>
  );
}
